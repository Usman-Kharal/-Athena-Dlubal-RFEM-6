function input_data() {
    var BASIC_DATA = category("Basic Data");
    parameter_int("Number of spans", "n", "", 3, UNIT.NONE, 1, 1, 100, true, true);
    parameter_check("Panels included to model stiffness", "panels_included", true);
    parameter_check("Panels above rails", "panels_eccentricity", true);
    condition("panels_included == true");
    parameter_check("Rails for panels above beams", "rails_eccentricity", true);
    parameter_check("Bracing", "create_bracing", false);

    category("Bracing", "", BASIC_DATA);
    condition("create_bracing == true");
    parameter_check("Span {{number}}", "span_check", false, "n");
    condition("create_bracing == true");

    var GEOMETRY = category("Geometry");
    category("Brackets", "", GEOMETRY);
    parameter_float("Height of post", "H", "", 6, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "H_1", "H<sub>1</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Beam length | Left", "a_1", "a<sub>1</sub>", 5.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Beam length | Right", "a_2", "a<sub>2</sub>", 5.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Angle of beam inclination", "alpha", "&alpha;", PI / 12, UNIT.ANGLE, -PI / 2, PI / 180, PI / 2, false, false);
    parameter_float("Distance", "L_t_1", "L<sub>t,1</sub>", 2.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "L_t_2", "L<sub>t,2</sub>", 2.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "L_b_1", "L<sub>b,1</sub>", 0.4, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "L_b_2", "L<sub>b,2</sub>", 0.4, UNIT.LENGTH, 0, 0.1, NAN, false, false);

    category("Rails", "", GEOMETRY);
    parameter_float("Distance", "b_0", "b<sub>0</sub>", 1, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "b_1", "b<sub>1</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "b_2", "b<sub>2</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "b_3", "b<sub>3</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Rail overhang | Left", "L_0_1", "L<sub>0,1</sub>", 1.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Rail overhang | Right", "L_0_2", "L<sub>0,2</sub>", 1.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Rail span {{number}}", "L", "L<sub>{{number}}</sub>", 10, UNIT.LENGTH, 0, 0.1, NAN, false, false, "n");

    category("Materials &amp; Sections");
    section(1, "Posts");
    section(2, "Beams");
    section(3, "Struts");
    section(4, "Rails");
    section(5, "Bracing");
    condition("create_bracing == true");

    category("Materials &amp; Thicknesses");
    condition("panels_included == true");
    thickness(1, "Thickness 1");

    category("Supports");
    nodal_support(1, "Nodal support");

    var LOADING_CATEGORY = loading_category("Loads");
    parameter_check("Self-weight", "self_weight_load_checkbox", true);
    parameter_check("Snow", "snow_load_checkbox", true);
    parameter_check("Wind", "wind_load_checkbox", true);

    category("Self-weight", false, LOADING_CATEGORY);
    condition("self_weight_load_checkbox == true");
    load_case(1, "Load case");

    category("Snow", false, LOADING_CATEGORY);
    condition("snow_load_checkbox == true");
    load_case(2, "Load case");

    parameter_float("Load magnitude", "magnitude_s", "s", 500, UNIT.LOADS_SURFACE_TYPE_LOAD, NAN, 100, NAN, true, false);

    category("Wind", false, LOADING_CATEGORY);
    condition("wind_load_checkbox == true");
    load_case(3, "Load case");

    parameter_float("Load magnitude", "magnitude_w", "w", -500, UNIT.LOADS_SURFACE_TYPE_LOAD, NAN, 100, NAN, true, false);
}


function generate() {

    //
    // Create structure
    //

    // auxiliary parameters
    var sin_a = sin(alpha);
    var cos_a = cos(alpha);
    var tan_a = tan(alpha)

    var multi_nodes = 13;                            // Number of nodes added within one bay
    var multi_members = 18;                            // Number of members added within one bay
    var total_nodes = multi_nodes * (n + 1) + 12;      // Total number of nodes
    var total_members_min = 14 * (n + 1) + 4 * (n + 2);        // Total number of members without bracing
    var total_members_max = 14 * (n + 1) + 4 * (n + 2) + 2 * n;  // Total number of members with bracing in all bays

    // create nodes (multi_nodes*(n + 1) + 12)
    Node(0, -L_0_1, a_1 * cos_a, -H + a_1 * sin_a);
    Node(1, -L_0_1, (a_1 - b_0) * cos_a, -H + (a_1 - b_0) * sin_a);
    Node(2, -L_0_1, (a_1 - b_0 - b_1) * cos_a, -H + (a_1 - b_0 - b_1) * sin_a);
    Node(3, -L_0_1, (a_1 - b_0 - b_1 - b_2) * cos_a, -H + (a_1 - b_0 - b_1 - b_2) * sin_a);
    Node(4, -L_0_1, (a_1 - b_0 - b_1 - b_2 - b_3) * cos_a, -H + (a_1 - b_0 - b_1 - b_2 - b_3) * sin_a);
    Node(5, -L_0_1, -a_2 * cos_a, -H - a_2 * sin_a);

    var L = 0;
    for (var i = 0; i < n + 1; ++i) {
        j = i * multi_nodes;
        Node(6 + j, L, 0.000, 0.000);  // nodal support
        Node(7 + j, L, L_b_1, -H + H_1);
        Node(8 + j, L, 0.000, -H + H_1);
        Node(9 + j, L, -L_b_2, -H + H_1);
        Node(10 + j, L, a_1 * cos_a, -H + a_1 * sin_a);
        Node(11 + j, L, (a_1 - b_0) * cos_a, -H + (a_1 - b_0) * sin_a);
        Node(12 + j, L, L_t_1, -H + L_t_1 * tan_a);
        Node(13 + j, L, (a_1 - b_0 - b_1) * cos_a, -H + (a_1 - b_0 - b_1) * sin_a);
        Node(14 + j, L, 0.000, -H);
        Node(15 + j, L, (a_1 - b_0 - b_1 - b_2) * cos_a, -H + (a_1 - b_0 - b_1 - b_2) * sin_a);
        Node(16 + j, L, -L_t_2, -H - L_t_2 * tan_a);
        Node(17 + j, L, (a_1 - b_0 - b_1 - b_2 - b_3) * cos_a, -H + (a_1 - b_0 - b_1 - b_2 - b_3) * sin_a);
        Node(18 + j, L, -a_2 * cos_a, -H - a_2 * sin_a);

        if (i == n) {
            break;
        }

        L = L + eval("L_" + (i + 1));     // sum of particular spans L_i
    }

    Node(19 + j, L + L_0_2, a_1 * cos_a, -H + a_1 * sin_a);
    Node(20 + j, L + L_0_2, (a_1 - b_0) * cos_a, -H + (a_1 - b_0) * sin_a);
    Node(21 + j, L + L_0_2, (a_1 - b_0 - b_1) * cos_a, -H + (a_1 - b_0 - b_1) * sin_a);
    Node(22 + j, L + L_0_2, (a_1 - b_0 - b_1 - b_2) * cos_a, -H + (a_1 - b_0 - b_1 - b_2) * sin_a);
    Node(23 + j, L + L_0_2, (a_1 - b_0 - b_1 - b_2 - b_3) * cos_a, -H + (a_1 - b_0 - b_1 - b_2 - b_3) * sin_a);
    Node(24 + j, L + L_0_2, -a_2 * cos_a, -H - a_2 * sin_a);

    // create member hinges
    var hinges_params_1 =
    {
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO,
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO
    }

    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinges_params_1);  // member hinge

    // create members
    var post_params = { "section_start": sections[1], "rotation_angle": PI / 2 };
    var beam_params = { "section_start": sections[2] };
    var strut_params = { "section_start": sections[3] };
    var rail_params = { "section_start": sections[4], "rotation_angle": alpha };
    var bracing_params = { "section_start": sections[5] };

    for (var i = 0; i < 4; ++i) {
        Member(i, [1 + i, 11 + 2 * i], "", rail_params);  // rails
    }

    for (var i = 0; i < n + 1; ++i) {
        j = i * multi_nodes;
        Member(undefined, [6 + j, 8 + j], "", post_params);  // posts
        Member(undefined, [8 + j, 14 + j], "", post_params);  // posts

        for (var k = 0; k < 8; ++k) {
            Member(undefined, [10 + j + k, 11 + j + k], "", beam_params);  // beams
        }

        Member(undefined, [7 + j, 8 + j], "", strut_params);  // struts
        Member(undefined, [8 + j, 9 + j], "", strut_params);  // struts

        var member = Member(undefined, [7 + j, 12 + j], "", strut_params);  // struts
        member.member_hinge_start = member_hinge;
        member.member_hinge_end = member_hinge;

        var member = Member(undefined, [9 + j, 16 + j], "", strut_params);  // struts
        member.member_hinge_start = member_hinge;
        member.member_hinge_end = member_hinge;

        if (i == n) {
            break;
        }

        for (var k = 0; k < 4; ++k) {
            Member(undefined, [11 + j + 2 * k, 24 + j + 2 * k], "", rail_params);  // rails
        }
    }

    for (var i = 0; i < 4; ++i) {
        Member(undefined, [11 + j + 2 * i, total_nodes - 5 + i], "", rail_params);  // rails
    }

    var count_members = total_members_min - 1;

    if (create_bracing == true) {
        for (var i = 0; i < n; ++i) {
            k = i + 1;
            if (multiplicity["span_check_" + k] == true)  // create bracing in span selected via check button
            {
                j = i * multi_nodes;
                var member = Member(undefined, [11 + j, 30 + j], "", bracing_params);  // bracing
                member.member_hinge_start = member_hinge;
                member.member_hinge_end = member_hinge;
                count_members++;

                var member = Member(undefined, [17 + j, 24 + j], "", bracing_params);  // bracing
                member.member_hinge_start = member_hinge;
                member.member_hinge_end = member_hinge;
                count_members++;
            }
        }
    }

    // create lines (surface boundary lines)
    for (var i = 0; i < 5; ++i) {
        Line(undefined, [0 + i, 1 + i]);  // left
    }

    Line(undefined, [0, 10]);  // front
    Line(undefined, [5, 18]);  // back

    for (var i = 0; i < n; ++i) {
        j = i * multi_nodes;
        Line(undefined, [10 + j, 23 + j]);  // front
        Line(undefined, [18 + j, 31 + j]);  // back
    }

    Line(undefined, [23 + j, total_nodes - 6]);  // front
    Line(undefined, [31 + j, total_nodes - 1]);  // back

    for (var i = 0; i < 5; ++i) {
        Line(undefined, [total_nodes - 6 + i, total_nodes - 5 + i]);  // right      
    }

    // create surfaces
    var surface_boundary_lines = [];

    for (var i = 0; i < 2 * (n + 2) + 10; ++i) {
        surface_boundary_lines.push(lines[count_members + 1 + i]);
    }
    Surface(0, surface_boundary_lines);

    // definition of integrated lines to prevent from automatic integration of diagonals into surface
    surfaces[0].auto_detection_of_integrated_objects = false;  // preventing automatic integration
    var surface_integrated_lines = [];
    for (var i = 0; i < n + 2; ++i) {
        j = i * multi_members;
        for (var k = 0; k < 4; ++k) {
            surface_integrated_lines.push(lines[0 + j + k]);  // rails
        }

        if (i == n + 1) { break; }

        if (panels_included !== true || panels_eccentricity !== true || rails_eccentricity !== true) {
            for (var k = 0; k < 8; ++k) {
                surface_integrated_lines.push(lines[6 + j + k]);  // beams
            }
        }
    }
    surfaces[0].integrated_lines = surface_integrated_lines;

    // create member eccentricities
    MemberEccentricity(1);
    member_eccentricities[1].specification_type = model.member_eccentricities.TYPE_RELATIVE;
    member_eccentricities[1].vertical_section_alignment = model.member_eccentricities.ALIGN_BOTTOM;
    member_eccentricities[1].transverse_offset_reference_type = model.member_eccentricities.TRANSVERSE_OFFSET_TYPE_FROM_MEMBER_SECTION;
    member_eccentricities[1].transverse_offset_reference_member = members[7];
    member_eccentricities[1].transverse_offset_member_reference_node = nodes[12];
    member_eccentricities[1].transverse_offset_vertical_alignment = model.member_eccentricities.ALIGN_TOP;

    // assign eccentricities to members (rails)
    if (rails_eccentricity == true) {
        for (var i = 0; i < n + 2; ++i) {
            for (var k = 0; k < 4; ++k) {
                members[18 * i + k].member_eccentricity_start = member_eccentricities[1];
                members[18 * i + k].member_eccentricity_end = member_eccentricities[1];
            }
        }
    }

    // create surface eccentricities
    SurfaceEccentricity(1);
    surface_eccentricities[1].thickness_alignment = model.surface_eccentricities.ALIGN_BOTTOM;
    surface_eccentricities[1].transverse_offset_active = true;
    surface_eccentricities[1].transverse_offset_reference_type = model.surface_eccentricities.TRANSVERSE_OFFSET_TYPE_FROM_MEMBER_SECTION;
    surface_eccentricities[1].transverse_offset_reference_member = members[1];
    surface_eccentricities[1].transverse_offset_alignment = model.surface_eccentricities.ALIGN_TOP;

    // assign eccentricities to surfaces
    if (panels_eccentricity == true) {
        surfaces[0].eccentricity = surface_eccentricities[1];
    }

    // assign supports to nodes
    for (var i = 0; i < n + 1; ++i) {
        j = i * multi_nodes;
        nodes[6 + j].support = nodal_supports[1];
    }

    //assign thicknesses to surfaces
    if (panels_included == true) {
        surfaces[0].thickness = thicknesses[1];
    }
    else {
        surfaces[0].type = model.surfaces.TYPE_LOAD_TRANSFER;
    }


    //
    // Create coordinate systems
    //

    // coordinate system for all dimensions
    var coordinate_system_params_1 =
    {
        "origin_coordinates": [0.000, 0.000, 0.000],
        "u_axis_point_coordinates": [1, -0.000, 0.000],
        "uw_plane_point_coordinates": [0.000, 0.000, 1]
    }
    CoordinateSystem(1, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params_1);

    // coordinate system for inclined dimensions
    var coordinate_system_params_2 =
    {
        "origin_coordinates": [0.000, 0.000, -H],
        "u_axis_point_coordinates": [1, 0.000, -H],
        "uw_plane_angle": alpha
    }
    var coordinate_system_2 = CoordinateSystem(2, model.coordinate_systems.TYPE_2_POINTS_AND_ANGLE, undefined, coordinate_system_params_2);
    coordinate_system_2.user_defined_name_enabled = true;
    coordinate_system_2.name = "UCS for inclined dims";


    //
    // Create dimensions (19 + 2*n)
    //

    var linear_dimension_params_1 = { "linear_coordinate_system": coordinate_systems[1] };
    var linear_dimension_params_2 = { "linear_coordinate_system": coordinate_systems[2] };

    // x dimensions
    // bottom
    for (var i = 1; i < n + 1; ++i) {
        j = (i - 1) * multi_nodes;
        LinearDimension(i, nodes[6 + j], nodes[19 + j], "xz", "L" + i.toString().sub(), 1.5, "", linear_dimension_params_1);
    }

    // top
    LinearDimension(false, nodes[5], nodes[18], "xy", "L<sub>0,1</sub>", -a_2 - 1.5, "", linear_dimension_params_2);

    for (var i = 1; i < n + 1; ++i) {
        j = (i - 1) * multi_nodes;
        LinearDimension(false, nodes[18 + j], nodes[31 + j], "xy", "L" + i.toString().sub(), -a_2 - 1.5, "", linear_dimension_params_2);
    }

    LinearDimension(false, nodes[total_nodes - 7], nodes[total_nodes - 1], "xy", "L<sub>0,2</sub>", -a_2 - 1.5, "", linear_dimension_params_2);
    LinearDimension(false, nodes[5], nodes[total_nodes - 1], "xy", "", -a_2 - 2.5, "", linear_dimension_params_2);

    // y dimensions
    // left
    LinearDimension(false, nodes[0], nodes[1], "yx", "b<sub>0</sub>", -L_0_1 - 1.5, "", linear_dimension_params_2);
    LinearDimension(false, nodes[1], nodes[2], "yx", "b<sub>1</sub>", -L_0_1 - 1.5, "", linear_dimension_params_2);
    LinearDimension(false, nodes[2], nodes[3], "yx", "b<sub>2</sub>", -L_0_1 - 1.5, "", linear_dimension_params_2);
    LinearDimension(false, nodes[3], nodes[4], "yx", "b<sub>3</sub>", -L_0_1 - 1.5, "", linear_dimension_params_2);
    LinearDimension(false, nodes[4], nodes[5], "yx", "", -L_0_1 - 1.5, "", linear_dimension_params_2);

    LinearDimension(false, nodes[0], nodes[14], "yx", "a<sub>1</sub>", -L_0_1 - 2.5, "", linear_dimension_params_2);
    LinearDimension(false, nodes[14], nodes[5], "yx", "a<sub>2</sub>", -L_0_1 - 2.5, "", linear_dimension_params_2);

    LinearDimension(false, nodes[0], nodes[5], "yx", "", -L_0_1 - 3.5, "", linear_dimension_params_2);

    // right
    LinearDimension(false, nodes[total_nodes - 13], nodes[total_nodes - 19], "yz", "L<sub>t,1</sub>", 1.5, "", linear_dimension_params_1);
    LinearDimension(false, nodes[total_nodes - 19], nodes[total_nodes - 9], "yz", "L<sub>t,2</sub>", 1.5, "", linear_dimension_params_1);

    LinearDimension(false, nodes[total_nodes - 18], nodes[total_nodes - 17], "yz", "L<sub>b,1</sub>", -H + H_1 + 1, "", linear_dimension_params_1);
    LinearDimension(false, nodes[total_nodes - 17], nodes[total_nodes - 16], "yz", "L<sub>b,2</sub>", -H + H_1 + 1, "", linear_dimension_params_1);

    // z dimensions
    LinearDimension(false, nodes[total_nodes - 19], nodes[total_nodes - 17], "zx", "", L + L_0_2 + 1.5, "", linear_dimension_params_1);
    LinearDimension(false, nodes[total_nodes - 17], nodes[total_nodes - 11], "zx", "H<sub>1</sub>", L + L_0_2 + 1.5, "", linear_dimension_params_1);

    LinearDimension(false, nodes[total_nodes - 19], nodes[total_nodes - 11], "zx", "H", L + L_0_2 + 2.5, "", linear_dimension_params_1);

    // slope dimensions
    var dim_slope = SlopeDimension(false, lines[6], "&alpha;", -1.5, 0, "downward", "xy", "", linear_dimension_params_1);
    //dim_slope.is_global_dimension_line_offset = true;

    if (alpha < 0)  // if alpha < 0 --> direction upward
    {
        dim_slope.slope_direction = model.dimensions.SLOPE_DIRECTION_UPWARD;
    }


    //
    // Create loads
    //

    // snow load
    var snow_load_case = load_cases[2];

    if (snow_load_case) {
        var snow_load = SurfaceLoad(1, snow_load_case);
        snow_load.load_direction = model.surface_loads.LOAD_DIRECTION_GLOBAL_Z_OR_USER_DEFINED_W_PROJECTED;
        snow_load.uniform_magnitude = magnitude_s;
        snow_load.surfaces = [surfaces[0]];
    }

    // wind load
    var wind_load_case = load_cases[3];

    if (wind_load_case) {
        var wind_load = SurfaceLoad(1, wind_load_case);
        wind_load.coordinate_system = model.surface_loads.COORDINATE_SYSTEM_TYPE_LOCAL;
        wind_load.load_direction = model.surface_loads.LOAD_DIRECTION_LOCAL_Z;
        wind_load.uniform_magnitude = magnitude_w;
        wind_load.surfaces = [surfaces[0]];
    }

}