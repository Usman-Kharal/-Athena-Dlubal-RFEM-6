function input_data() {
    category("Basic Data");
    parameter_int("Number of bays", "n", "", 3, UNIT.NONE, 1, 1, 1000, true, false);

    category("Geometry");
    parameter_float("Frame span", "a", "", 12, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Post distance", "a_1", "a<sub>1</sub>", 3, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Column height", "H_1", "H<sub>1</sub>", 5, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Roof height", "H_2", "H<sub>2</sub>", 1, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Length of rafter haunch", "l_r", "l<sub>r</sub>", 1, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Bay length {{number}}", "L", "L<sub>{{number}}</sub>", 4, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false, "n");

    category("Supports");
    nodal_support(1, "Nodal support | Columns | Left");
    nodal_support(2, "Nodal support | Columns | Right");
    nodal_support(3, "Nodal support | Posts");

    category("Sections");
    section(1, "Columns");
    section(2, "Columns at frame corner");
    section(3, "Rafters");
    section(4, "Rafters at frame corner");
    section(5, "Columns | Outer bent");
    section(6, "Posts | Outer bent");
    section(7, "Rafters | Outer bent");
    section(8, "Purlins");

    category("Thickness");
    thickness(1, "Roof thickness");

    var LOADING_CATEGORY = loading_category("Loads");
    parameter_check("Live load", "live_load_checkbox", true);
    parameter_check("Snow load", "snow_load_checkbox", true);

    category("Live load", false, LOADING_CATEGORY);
    condition("live_load_checkbox == true");
    load_case(1, "Load case");
    parameter_float("Force in X-direction", "force_x", "P<sub>x</sub>", 0, UNIT.LOADS_FORCE, NAN, 100, NAN, true, false);
    parameter_float("Force in Y-direction", "force_y", "P<sub>y</sub>", 0, UNIT.LOADS_FORCE, NAN, 100, NAN, true, false);
    parameter_float("Force in Z-direction", "force_z", "P<sub>z</sub>", 1000, UNIT.LOADS_FORCE, NAN, 100, NAN, true, false);
    parameter_float("Multiply factor", "factor_1", "f<sub>1</sub>", 1.0, UNIT.LOADING_FACTOR, 0, 0.1, NAN, false, false);

    category("Snow load", false, LOADING_CATEGORY);
    condition("snow_load_checkbox == true");
    load_case(2, "Load case");
    parameter_float("Magnitude", "magnitude", "p", 1000, UNIT.LOADS_SURFACE_TYPE_LOAD, NAN, 100, NAN, true, false);
    parameter_float("Multiply factor", "factor_2", "f<sub>2</sub>", 1.0, UNIT.LOADING_FACTOR, 0, 0.1, NAN, false, false);
}


function generate() {
    //
    // Create structure
    //

    var node_count = 7;                            // nodes count in one frame
    var line_count = 9;                            // lines/members count in one frame + between two frames (6 + 3)
    var total_nodes = 9 + (n - 1) * node_count + 9;  // total nodes

    // auxiliary parameters
    var sin_a = sin(atan(2 * H_2 / a));
    var cos_a = cos(atan(2 * H_2 / a));

    // create nodes (9 + (n - 1)*node_count + 9)
    // first bent
    Node(0, 0.000, 0.000, 0.000);  // support
    Node(1, a, 0.000, 0.000);  // support
    Node(2, a_1, 0.000, 0.000);  // support
    Node(3, a - a_1, 0.000, 0.000);  // support
    Node(4, 0.000, 0.000, -H_1);
    Node(5, a, 0.000, -H_1);
    Node(6, a_1, 0.000, -H_1 - 2 * H_2 * a_1 / a);
    Node(7, a - a_1, 0.000, -H_1 - 2 * H_2 * a_1 / a);
    Node(8, 0.5 * a, 0.000, -H_1 - H_2);

    // inner bents  
    var L = 0;
    for (var i = 0; i < n - 1; i++) {
        L = L + eval("L_" + (i + 1));
        var n_i = i * node_count;  // index of first node in actual frame

        Node(9 + n_i, 0.000, L, 0.000);  // support
        Node(10 + n_i, a, L, 0.000);  // support
        Node(11 + n_i, 0.000, L, -H_1);
        Node(12 + n_i, a, L, -H_1);
        Node(13 + n_i, l_r * cos_a, L, -H_1 - l_r * sin_a);
        Node(14 + n_i, a - l_r * cos_a, L, -H_1 - l_r * sin_a);
        Node(15 + n_i, 0.5 * a, L, -H_1 - H_2);
    }

    // last bent
    L = L + eval("L_" + n);
    var n_i = i * node_count;

    Node(9 + n_i, 0.000, L, 0.000);  // support
    Node(10 + n_i, a, L, 0.000);  // support
    Node(11 + n_i, a_1, L, 0.000);  // support
    Node(12 + n_i, a - a_1, L, 0.000);  // support
    Node(13 + n_i, 0.000, L, -H_1);
    Node(14 + n_i, a, L, -H_1);
    Node(15 + n_i, a_1, L, -H_1 - 2 * H_2 * a_1 / a);
    Node(16 + n_i, a - a_1, L, -H_1 - 2 * H_2 * a_1 / a);
    Node(17 + n_i, 0.5 * a, L, -H_1 - H_2);


    // create members
    var hinge_params =                                                 // define hinge
    {
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO,
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO
    }

    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinge_params);     // member hinge

    var column_inner_params_1 =
    {
        "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
        "section_alignment": model.members.SECTION_ALIGNMENT_TOP,
        "section_start": sections[1],
        "section_end": sections[2]
    };

    var column_inner_params_2 =
    {
        "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
        "section_alignment": model.members.SECTION_ALIGNMENT_BOTTOM,
        "section_start": sections[1],
        "section_end": sections[2]
    };

    var rafter_inner_params_1 =
    {
        "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
        "section_alignment": model.members.SECTION_ALIGNMENT_TOP,
        "section_start": sections[4],
        "section_end": sections[3]
    };

    var rafter_inner_params_2 = { "section_start": sections[3] };
    var column_outer_params = { "section_start": sections[5] };

    var post_params =
    {
        "section_start": sections[6],
        "rotation_angle": Math.PI / 2,
        "member_hinge_end": member_hinge
    };

    var rafter_outer_params = { "section_start": sections[7] };

    var purlin_params =
    {
        "section_start": sections[8],
        "member_hinge_start": member_hinge,
        "member_hinge_end": member_hinge
    };

    // first bent
    var members_counter = 0;
    Member(members_counter++, [0, 4], "", column_outer_params);  // column
    Member(members_counter++, [1, 5], "", column_outer_params);  // column
    Member(members_counter++, [2, 6], "", post_params);          // post
    Member(members_counter++, [3, 7], "", post_params);          // post
    Member(members_counter++, [4, 6], "", rafter_outer_params);  // rafter
    Member(members_counter++, [6, 8], "", rafter_outer_params);  // rafter
    Member(members_counter++, [5, 7], "", rafter_outer_params);  // rafter
    Member(members_counter++, [7, 8], "", rafter_outer_params);  // rafter  

    // inner bents
    for (var i = 0; i < n - 1; i++) {
        var n_i = i * node_count;                                                      // index of first node in actual frame
        Member(members_counter++, [4 + n_i, 11 + n_i], "", purlin_params);          // purlin
        Member(members_counter++, [5 + n_i, 12 + n_i], "", purlin_params);          // purlin
        Member(members_counter++, [8 + n_i, 15 + n_i], "", purlin_params);          // purlin
        Member(members_counter++, [9 + n_i, 11 + n_i], "", column_inner_params_1);  // column
        Member(members_counter++, [10 + n_i, 12 + n_i], "", column_inner_params_2);  // column
        Member(members_counter++, [11 + n_i, 13 + n_i], "", rafter_inner_params_1);  // rafter
        Member(members_counter++, [13 + n_i, 15 + n_i], "", rafter_inner_params_2);  // rafter
        Member(members_counter++, [12 + n_i, 14 + n_i], "", rafter_inner_params_1);  // rafter
        Member(members_counter++, [14 + n_i, 15 + n_i], "", rafter_inner_params_2);  // rafter
    }

    // last bent
    var n_i = i * node_count;
    Member(members_counter++, [4 + n_i, 13 + n_i], "", purlin_params);        // purlin
    Member(members_counter++, [5 + n_i, 14 + n_i], "", purlin_params);        // purlin
    Member(members_counter++, [8 + n_i, 17 + n_i], "", purlin_params);        // purlin     
    Member(members_counter++, [9 + n_i, 13 + n_i], "", column_outer_params);  // column
    Member(members_counter++, [10 + n_i, 14 + n_i], "", column_outer_params);  // column
    Member(members_counter++, [11 + n_i, 15 + n_i], "", post_params);          // post
    Member(members_counter++, [12 + n_i, 16 + n_i], "", post_params);          // post
    Member(members_counter++, [13 + n_i, 15 + n_i], "", rafter_outer_params);  // rafter
    Member(members_counter++, [15 + n_i, 17 + n_i], "", rafter_outer_params);  // rafter
    Member(members_counter++, [14 + n_i, 16 + n_i], "", rafter_outer_params);  // rafter
    Member(members_counter++, [16 + n_i, 17 + n_i], "", rafter_outer_params);  // rafter

    //create surfaces
    var surfaces_counter = 0;
    for (var i = 0; i < n; i++) {
        var k = i * line_count;  // index of first line in actual frame

        if (i == n - 1) {
            break;
        }
        Surface(surfaces_counter++, [4 + k, 5 + k, 8 + k, 10 + k, 13 + k, 14 + k]);
        Surface(surfaces_counter++, [6 + k, 7 + k, 9 + k, 10 + k, 15 + k, 16 + k]);
    }

    Surface(surfaces_counter++, [4 + k, 5 + k, 8 + k, 10 + k, 15 + k, 16 + k]);
    Surface(surfaces_counter++, [6 + k, 7 + k, 9 + k, 10 + k, 17 + k, 18 + k]);

    // assign supports to nodes
    // columns
    nodes[0].support = nodal_supports[1];
    nodes[1].support = nodal_supports[2];

    for (var i = 0; i < n; i++) {
        j = i * node_count;
        nodes[9 + j].support = nodal_supports[1];
        nodes[10 + j].support = nodal_supports[2];
    }

    // posts
    nodes[2].support = nodal_supports[3];
    nodes[3].support = nodal_supports[3];
    nodes[total_nodes - 7].support = nodal_supports[3];
    nodes[total_nodes - 6].support = nodal_supports[3];

    // assign thicknesses to surfaces
    for (var i = 0; i < surfaces_counter; i++) {
        surfaces[i].thickness = thicknesses[1];
    }


    //
    // Create coordinate systems
    //

    // coordinate system for all dimensions
    var coordinate_system_params_1 =
    {
        "origin_coordinates": [0.000, 0.000, 0.000],
        "u_axis_point_coordinates": [1, 0.000, 0.000],
        "uw_plane_point_coordinates": [0.000, 0.000, 1]
    }
    CoordinateSystem(1, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params_1);


    //
    // Create dimensions
    //

    var linear_dimension_params_1 =
    {
        "linear_coordinate_system": coordinate_systems[1]
    };


    // x dimensions
    LinearDimension(1, nodes[total_nodes - 9], nodes[total_nodes - 7], "xy", "a<sub>1</sub>", L + 1, "", linear_dimension_params_1);
    LinearDimension(2, nodes[total_nodes - 6], nodes[total_nodes - 8], "xy", "a<sub>1</sub>", L + 1, "", linear_dimension_params_1);
    LinearDimension(3, nodes[total_nodes - 6], nodes[total_nodes - 7], "xy", "", L + 1, "", linear_dimension_params_1);

    LinearDimension(4, nodes[total_nodes - 9], nodes[total_nodes - 8], "xy", "a", L + 2, "", linear_dimension_params_1);

    // y dimensions
    for (i = 1; i < n + 1; i++) {
        if (i == 1) {
            LinearDimension(false, nodes[1], nodes[10], "yx", "L" + i.toString().sub(), a + 1, "", linear_dimension_params_1)
            continue;
        }
        j = (i - 1) * node_count;
        LinearDimension(false, nodes[3 + j], nodes[10 + j], "yx", "L" + i.toString().sub(), a + 1, "", linear_dimension_params_1)
    }

    // sum dimension
    if (n > 1) {
        LinearDimension(false, nodes[1], nodes[total_nodes - 8], "yx", "", a + 2, "", linear_dimension_params_1);
    }

    // z dimensions
    LinearDimension(false, nodes[1], nodes[5], "zx", "H<sub>1</sub>", a + 1, "", linear_dimension_params_1);
    LinearDimension(false, nodes[5], nodes[8], "zx", "H<sub>2</sub>", a + 1, "", linear_dimension_params_1);
    LinearDimension(false, nodes[1], nodes[8], "zx", "", a + 2, "", linear_dimension_params_1);

    // others
    if (n > 1) {
        LinearDimension(false, nodes[total_nodes - 14], nodes[total_nodes - 12], "", "l<sub>r</sub>", 1).linear_plane = model.dimensions.PLANE_SECOND;
        LinearDimension(false, nodes[total_nodes - 13], nodes[total_nodes - 11], "", "l<sub>r</sub>", 1).linear_plane = model.dimensions.PLANE_SECOND;
    }


    //
    // Create loads
    //  

    var live_load_case = load_cases[1];
    if (live_load_case) {
        var live_load = NodalLoad(1, live_load_case);
        live_load.load_type = model.nodal_loads.LOAD_TYPE_COMPONENTS;
        live_load.components_force_x = force_x * factor_1;
        live_load.components_force_y = force_y * factor_1;
        live_load.components_force_z = force_z * factor_1;

        var nodes_to_load = [];
        for (var i = 0; i < (n + 0) * node_count; ++i) {
            if (i % 7 < 2) {
                nodes_to_load.push(nodes[i + 4]);
            }
        }
        nodes_to_load.push(nodes[i + 6]);
        nodes_to_load.push(nodes[i + 7]);

        live_load.nodes = nodes_to_load;
    }

    var snow_load_case = load_cases[2];
    if (snow_load_case) {
        var surface_count = 2;
        var snow_load = SurfaceLoad(1, snow_load_case);
        snow_load.uniform_magnitude = magnitude * factor_2;

        var surfaces_to_load = [];
        for (var i = 0; i < surfaces_counter; ++i) {
            surfaces_to_load.push(surfaces[i]);
            surfaces_to_load.push(surfaces[i]);
        }
        snow_load.surfaces = surfaces_to_load;
    }

}