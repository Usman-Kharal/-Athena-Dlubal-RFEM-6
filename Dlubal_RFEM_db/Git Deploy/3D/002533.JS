function input_data() {
    category("Basic Data");
    parameter_int("Number of bays", "n", "", 3, UNIT.NONE, 1, 1, 1000, true, false);

    category("Geometry");
    parameter_float("Frame span", "a", "", 6, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Column height", "H_1", "H<sub>1</sub>", 5, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Roof height", "H_2", "H<sub>2</sub>", 1, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false);
    parameter_float("Bay length {{number}}", "L", "L<sub>{{number}}</sub>", 4, UNIT.LENGTH, 0, 0.1, MAXIMUM, false, false, "n");

    category("Supports");
    nodal_support(1, "Nodal support | Left");
    nodal_support(2, "Nodal support | Right");

    category("Sections");
    section(1, "Columns");
    section(2, "Columns at frame corner");
    section(3, "Rafters");
    section(4, "Rafters at frame corner");
    section(5, "Purlins");

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

    var node_count = 5;  // nodes count in one frame
    var line_count = 7;  // lines/members count in one frame + between two frames (4 + 3)

    // create nodes ((n + 1)*node_count)
    var L = 0;
    for (var i = 0; i < n + 1; i++) {
        var n_i = i * node_count;  // index of first node in actual frame

        Node(n_i + 0, 0.000, L, 0.000);
        Node(n_i + 1, a, L, 0.000);
        Node(n_i + 2, 0.000, L, -H_1);
        Node(n_i + 3, a, L, -H_1);
        Node(n_i + 4, 0.5 * a, L, -H_1 - H_2);

        if (i === n)  // to get variable L with value for dimension offset
        {
            break;
        }

        L = L + eval("L_" + (i + 1));
    }

    // create members
    var hinge_params =                                                 // define hinge
    {
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO,
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO
    }

    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinge_params);     // member hinge

    var column_params_1 =
    {
        "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
        "section_alignment": model.members.SECTION_ALIGNMENT_TOP,
        "section_start": sections[1],
        "section_end": sections[2]
    };

    var column_params_2 =
    {
        "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
        "section_alignment": model.members.SECTION_ALIGNMENT_BOTTOM,
        "section_start": sections[1],
        "section_end": sections[2]
    };

    var rafter_params =
    {
        "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
        "section_alignment": model.members.SECTION_ALIGNMENT_TOP,
        "section_start": sections[4],
        "section_end": sections[3]
    };

    var purlin_params = { "section_start": sections[5] };

    var members_counter = 0;
    for (var i = 0; i < n + 1; i++) {
        var n_i = i * node_count; // index of first node in actual frame

        if (i > 0) {
            var member_0 = Member(members_counter++, [n_i + 2 - node_count, n_i + 2], "", purlin_params);  // purlin
            member_0.member_hinge_start = member_hinge;
            member_0.member_hinge_end = member_hinge;

            var member_1 = Member(members_counter++, [n_i + 3 - node_count, n_i + 3], "", purlin_params);  // purlin
            member_1.member_hinge_start = member_hinge;
            member_1.member_hinge_end = member_hinge;

            var member_2 = Member(members_counter++, [n_i + 4 - node_count, n_i + 4], "", purlin_params);  // purlin
            member_2.member_hinge_start = member_hinge;
            member_2.member_hinge_end = member_hinge;
        }

        Member(members_counter++, [n_i + 0, n_i + 2], "", column_params_1);  // column
        Member(members_counter++, [n_i + 1, n_i + 3], "", column_params_2);  // column
        Member(members_counter++, [n_i + 2, n_i + 4], "", rafter_params);  // rafter
        Member(members_counter++, [n_i + 3, n_i + 4], "", rafter_params);  // rafter
    }

    //create surfaces
    var surfaces_counter = 0;
    for (var i = 1; i < n + 1; i++) {
        var k = i * line_count;  // index of first line in actual frame
        Surface(surfaces_counter++, [k + 2 - line_count, k + 4 - line_count, k + 6 - line_count, k + 2]);
        Surface(surfaces_counter++, [k + 3 - line_count, k + 5 - line_count, k + 6 - line_count, k + 3]);
    }

    // assign supports to nodes
    for (var i = 0; i < n + 1; i++) {
        j = i * node_count;
        nodes[0 + j].support = nodal_supports[1];
        nodes[1 + j].support = nodal_supports[2];
    }

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
    LinearDimension(1, nodes[(n + 1) * node_count - 5], nodes[(n + 1) * node_count - 4], "xy", "a", L + 1, "", linear_dimension_params_1);

    // y dimensions
    for (i = 1; i < n + 1; i++) {
        j = (i - 1) * node_count;
        LinearDimension(false, nodes[1 + j], nodes[6 + j], "yx", "L" + i.toString().sub(), a + 1, "", linear_dimension_params_1)
    }

    // sum dimension
    if (n > 1) {
        LinearDimension(false, nodes[1], nodes[(n + 1) * node_count - 4], "yx", "", a + 2, "", linear_dimension_params_1);
    }

    // z dimensions
    LinearDimension(false, nodes[1], nodes[3], "zx", "H<sub>1</sub>", a + 1, "", linear_dimension_params_1);
    LinearDimension(false, nodes[3], nodes[4], "zx", "H<sub>2</sub>", a + 1, "", linear_dimension_params_1);
    LinearDimension(false, nodes[1], nodes[4], "zx", "", a + 2, "", linear_dimension_params_1);


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
        for (var i = 0; i < (n + 1) * node_count; ++i) {
            if (i % 5 < 2) {
                nodes_to_load.push(nodes[i + 2]);
            }
        }
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