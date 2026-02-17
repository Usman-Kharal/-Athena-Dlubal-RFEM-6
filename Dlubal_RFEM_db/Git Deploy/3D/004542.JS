function input_data() {
    category("Basic Data");
    parameter_int("Number of bays", "n", "", 14, UNIT.NONE, 6, 2, 50, true, true);
    parameter_check("Define min. height of pathway", "min_height", true);
    parameter_float("Minimum height of pathway", "h_m", "h<sub>m</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    condition("min_height == true");

    category("Geometry");
    parameter_float("Length", "L", "", 20, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Length 1", "L_1", "L<sub>1</sub>", 4, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);
    parameter_float("Length 2", "L_2", "L<sub>2</sub>", 12, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);

    parameter_float("Width", "W", "", 2.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Height", "H", "H", 4, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Height 1", "H_1", "H<sub>1</sub>", 4, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);
    parameter_float("Height 2", "H_2", "H<sub>2</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);

    category("Materials &amp; Sections");
    section(1, "Top chord");
    section(2, "Bottom chord");
    section(3, "Verticals");
    section(4, "Bracings");
    section(5, "Deck");
    section(6, "Cables");

    category("Materials & Thicknesses");
    thickness(1, "Deck");

    category("Supports");
    nodal_support(1, "Nodal support | Left");
    nodal_support(2, "Nodal support | Right");
}

function generate() {
    ASSERT(n % 2 == 0, "n should be even");
    var calculated_parameters = {};
    var L_1 = 2 * L / n;
    var L_2 = L - 2 * L_1;
    var L_m = L - L_1;
    calculated_parameters["L_1"] = L_1;
    calculated_parameters["L_2"] = L_2;

    //
    // Create structure
    //

    // create nodes
    var num_node = 0;

    var H_2 = H * (1 - (sqr(L / n - (L_m / 2))) / sqr(L_m / 2));
    var H_1 = H - H_2;
    calculated_parameters["H_2"] = H_2;
    calculated_parameters["H_1"] = H_1;

    for (var j = 0; j < 2; ++j) {
        Node(num_node, 0, j * W, 0);
        num_node++;
        var x = 0;
        for (var i = 0; i < n - 1; ++i) {
            x = i * L / n;
            Node(num_node, x + L_1 / 2, j * W, H_2 - 1 * H * (1 - (sqr(x - (L_m / 2))) / sqr(L_m / 2)));
            num_node++;
        };
        Node(num_node, L_m + L_1, j * W, 0);
        num_node++;
    };

    var ref_hor = num_node;

    for (var j = 0; j < 2; ++j) {
        Node(num_node, L_1 / 2, j * W, 0);
        num_node++;
        for (var i = 0; i < n - 5; ++i) {
            Node(num_node, (i + 3) * L / n, j * W, 0);
            num_node++;
        };
        Node(num_node, L_m + L_1 / 2, j * W, 0);
        num_node++;
    };

    // Create members
    var chord = {
        "section_start": sections[1],
        "type": model.members.TYPE_BEAM
    };
    var horizontals = {
        "section_start": sections[2],
        "type": model.members.TYPE_BEAM
    };
    var verticals = {
        "section_start": sections[3],
        "type": model.members.TYPE_BEAM
    };
    var bracing = {
        "section_start": sections[4],
        "type": model.members.TYPE_BEAM
    };
    var deck = {
        "section_start": sections[5],
        "type": model.members.TYPE_BEAM
    };
    var cables = {
        "section_start": sections[6],
        "type": model.members.TYPE_CABLE
    };

    var mem_num = 0;

    // creating arch
    for (var j = 0; j < 2; ++j) {
        Member(mem_num, [j * (n + 1), 1 + j * (n + 1)], "", chord);
        lines[mem_num].type = model.lines.TYPE_PARABOLA;
        lines[mem_num].parabola_first_node = nodes[j * (n + 1)];
        lines[mem_num].parabola_control_point = $V(L_1 / 4, j * W, H_2 - 1 * H * (1 - (sqr(L_1 / 4 - (L_m / 2))) / sqr(L_m / 2)));
        lines[mem_num].parabola_second_node = nodes[1 + j * (n + 1)];
        mem_num++;

        for (var i = 0; i < n - 2; ++i) {
            Member(mem_num, [1 + i + j * (n + 1), 2 + i + j * (n + 1)], "", chord);
            x = i * L / n;
            lines[mem_num].type = model.lines.TYPE_PARABOLA;
            lines[mem_num].parabola_first_node = nodes[1 + i + j * (n + 1)];
            lines[mem_num].parabola_control_point = $V(x + L_1 / 2 + L_1 / 4, j * W, H_2 - 1 * H * (1 - (sqr((x + L_1 / 4) - (L_m / 2))) / sqr(L_m / 2)));
            lines[mem_num].parabola_second_node = nodes[2 + i + j * (n + 1)];
            mem_num++;
        };

        Member(mem_num, [n - 1 + j * (n + 1), n + j * (n + 1)], "", chord);
        lines[mem_num].type = model.lines.TYPE_PARABOLA;
        lines[mem_num].parabola_first_node = nodes[n - 1 + j * (n + 1)];
        lines[mem_num].parabola_control_point = $V(L - L_1 / 4, j * W, H_2 - 1 * H * (1 - (sqr(L_1 / 4 - (L_m / 2))) / sqr(L_m / 2)));
        lines[mem_num].parabola_second_node = nodes[n + j * (n + 1)];
        mem_num++;
    };

    // Create verticals
    // define a hinge
    var hinges_params_1 =
    {
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO,
        "moment_release_mz": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO
    }
    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinges_params_1);

    Member(mem_num, [1, ref_hor], "", verticals);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    Member(mem_num, [n - 1, ref_hor + n - 4], "", verticals);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    Member(mem_num, [n + 2, ref_hor + n - 3], "", verticals);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    Member(mem_num, [ref_hor - 2, num_node - 1], "", verticals);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    // Create horizontals
    for (var j = 0; j < 2; ++j) {
        Member(mem_num, [j * (n + 1), ref_hor + j * (n - 3)], "", horizontals);
        mem_num++;
        Member(mem_num, [ref_hor + j * (n - 3), 2 + j * (n + 1)], "", horizontals);
        mem_num++;
        Member(mem_num, [2 + j * (n + 1), ref_hor + 1 + j * (n - 3)], "", horizontals);
        mem_num++;

        for (var i = 0; i < n - 6; ++i) {
            Member(mem_num, [ref_hor + 1 + i + j * (n - 3), ref_hor + 2 + i + j * (n - 3)], "", horizontals);
            mem_num++;
        };

        Member(mem_num, [ref_hor + n - 5 + j * (n - 3), n - 2 + j * (n + 1)], "", horizontals);
        mem_num++;
        Member(mem_num, [n - 2 + j * (n + 1), ref_hor + n - 4 + j * (n - 3)], "", horizontals);
        mem_num++;
        Member(mem_num, [ref_hor + n - 4 + j * (n - 3), n + j * (n + 1)], "", horizontals);
        mem_num++;
    };

    // Creating cables
    for (var i = 0; i < n - 5; ++i) {
        Member(mem_num, [3 + i, ref_hor + 1 + i], "", cables);
        mem_num++;
        Member(mem_num, [n + 4 + i, ref_hor + n - 2 + i], "", cables);
        mem_num++;
    };

    // Creating deck beams
    MemberEccentricity(1);
    member_eccentricities[1].specification_type = model.member_eccentricities.TYPE_RELATIVE;
    member_eccentricities[1].vertical_section_alignment = model.member_eccentricities.ALIGN_TOP;
    member_eccentricities[1].horizontal_section_alignment = model.member_eccentricities.ALIGN_MIDDLE;

    Member(mem_num, [0, n + 1], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
    Member(mem_num, [ref_hor, ref_hor + n - 3], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
    Member(mem_num, [2, n + 3], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
    Member(mem_num, [n - 2, 2 * n - 1], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
    Member(mem_num, [ref_hor + n - 4, num_node - 1], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
    Member(mem_num, [n, 2 * n + 1], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;

    for (var i = 0; i < n - 5; ++i) {
        Member(mem_num, [ref_hor + 1 + i, ref_hor + n - 2 + i], "", deck);
        members[mem_num].member_eccentricity_start = member_eccentricities[1];
        members[mem_num].member_eccentricity_end = member_eccentricities[1];
        mem_num++;
    };

    // creating bracing
    Member(mem_num, [1, n + 2], "", bracing);
    mem_num++;
    Member(mem_num, [n - 1, 2 * n], "", bracing);
    mem_num++;

    for (var i = 0; i < n - 5; ++i) {
        if (min_height == true && -nodes[3 + i].coordinate_3 < h_m) { continue; };
        Member(mem_num, [3 + i, n + 4 + i], "", bracing);
        mem_num++;
    };

    // Creating deck lines and surface
    Line(mem_num, [0, n]);
    mem_num++;
    Line(mem_num, [n + 1, 2 * n + 1]);
    mem_num++;
    Line(mem_num, [0, n + 1]);
    mem_num++;
    Line(mem_num, [n, 2 * n + 1]);

    Surface(0, [lines[mem_num], lines[mem_num - 1], lines[mem_num - 2], lines[mem_num - 3]]).type = model.surfaces.TYPE_STANDARD;
    surfaces[0].geometry = model.surfaces.GEOMETRY_PLANE;
    surfaces[0].thickness = thicknesses[1];

    // assign supports to nodes 
    nodes[0].support = nodal_supports[1];
    nodes[n + 1].support = nodal_supports[1];
    nodes[n].support = nodal_supports[2];
    nodes[2 * n + 1].support = nodal_supports[2];

    //
    // Create dimensions
    // coordinate system for all dimensions
    var coordinate_system_params_1 =
    {
        "origin_coordinates": [0.000, 0.000, 0.000],
        "u_axis_point_coordinates": [1, 0.000, 0.000],
        "uw_plane_point_coordinates": [0.000, 0.000, 1]
    }
    CoordinateSystem(1, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params_1);

    var linear_dimension_params_1 =
    {
        "linear_coordinate_system": coordinate_systems[1],
    };

    // x dimensions
    LinearDimension(undefined, nodes[n + 1], nodes[2 * n + 1], "xy", "L", W + 2, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[n + 1], nodes[n + 3], "xy", "L<sub>1</sub>", W + 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[2 * n + 1], nodes[2 * n - 1], "xy", "L<sub>1</sub>", W + 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[n + 3], nodes[2 * n - 1], "xy", "L<sub>2</sub>", W + 1, "", linear_dimension_params_1);

    // y dimensions
    LinearDimension(undefined, nodes[n], nodes[n + 1], "yx", "W", L + 1, "", linear_dimension_params_1);

    // z dimensions
    LinearDimension(undefined, nodes[n], nodes[n - 1], "zx", "H<sub>1</sub>", L + 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[n - 2], nodes[n / 2], "zx", "H<sub>2</sub>", L + 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[n - 1], nodes[n / 2], "zx", "H", L + 2, "", linear_dimension_params_1);

    return calculated_parameters;
}