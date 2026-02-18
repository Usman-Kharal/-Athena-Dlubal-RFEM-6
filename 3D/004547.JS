function input_data() {
    category("Basic Data");
    parameter_int("Number of bays", "n", "", 8, UNIT.NONE, 4, 2, 50, true, true);

    parameter_check("Define min. height of pathway", "min_height", true);
    parameter_float("Minimum height of pathway", "h_m", "h<sub>m</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    condition("min_height == true");

    category("Geometry");
    parameter_float("Total length", "L", "", 16, UNIT.LENGTH, 0, 0.1, NAN, false, false);

    parameter_float("Height", "H", "", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Width", "W", "", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Width 1", "W_1", "W<sub>1</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, false, false);

    category("Materials &amp; Sections");
    section(1, "Top chord");
    section(2, "Bottom chord");
    section(3, "Diagonals");
    section(4, "Verticals");
    section(5, "Deck beams");
    section(6, "Bracing");

    category("Materials & Thicknesses");
    thickness(1, "Deck");

    category("Supports");
    nodal_support(1, "Nodal support | Left");
    nodal_support(2, "Nodal support | Right");
}

function generate() {
    ASSERT(n % 2 == 0, "n should be even");
    //
    // Create structure
    //

    // create nodes
    var d = (W - W_1) / 2;
    var alpha = atan(d / H);
    var H_d = sqrt(sqr(d) + sqr(H));

    var coordinate_system_params_1 =
    {
        "origin_coordinates": [0, 0, 0],
        "rotation_angle_1": alpha,
        "rotation_angle_2": 0,
        "rotation_angle_3": 0
    }
    CoordinateSystem(1, model.coordinate_systems.TYPE_POINT_AND_3_ANGLES, undefined, coordinate_system_params_1);

    var coordinate_system_params_2 =
    {
        "origin_coordinates": [0, W, 0],
        "rotation_angle_1": -alpha,
        "rotation_angle_2": 0,
        "rotation_angle_3": 0
    }
    CoordinateSystem(2, model.coordinate_systems.TYPE_POINT_AND_3_ANGLES, undefined, coordinate_system_params_2);

    var num_node = 0;
    for (var j = 0; j < 2; ++j) {
        // Node of bottom chord
        for (var i = 0; i < n + 1; ++i) {
            Node(num_node, i * L / n, j * W, 0);
            num_node++;
        };

        // Nodes of top chord
        for (var i = 1; i < 2 * n; ++i) {
            Node(num_node);
            x = i * (L / n) / 2;
            nodes[num_node].coordinate_system = coordinate_systems[j + 1];
            nodes[num_node].coordinates = $V(x, 0, -1 * H_d * (1 - (sqr(x - (L / 2))) / sqr(L / 2)));
            num_node++;
        };

    };


    // Create members
    var top_chord = {
        "section_start": sections[1],
        "type": model.members.TYPE_BEAM
    };
    var bottom_chord = {
        "section_start": sections[2],
        "type": model.members.TYPE_BEAM
    };
    var diagonals = {
        "section_start": sections[3],
        "type": model.members.TYPE_BEAM
    };
    var verticals = {
        "section_start": sections[4],
        "type": model.members.TYPE_BEAM
    };
    var deck = {
        "section_start": sections[5],
        "type": model.members.TYPE_BEAM
    };
    var bracing = {
        "section_start": sections[6],
        "type": model.members.TYPE_BEAM
    };

    // Bottom chord
    var mem_num = 0
    for (var j = 0; j < 2; ++j) {
        for (var i = 0; i < n; ++i) {
            Member(mem_num, [i + j * 3 * n, i + 1 + j * 3 * n], "", bottom_chord);
            members[mem_num].rotation_angle = PI;
            mem_num++;
        };
    };

    // define a hinge
    var hinges_params_1 =
    {
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO,
        "moment_release_mz": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO
    };

    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinges_params_1);

    // Cerating verticals

    for (var j = 0; j < 2; ++j) {
        for (var i = 0; i < n - 1; ++i) {
            Member(mem_num, [i + 1 + j * 3 * n, 2 * i + n + 2 + j * 3 * n], "", verticals);
            members[mem_num].member_hinge_start = member_hinge;
            members[mem_num].member_hinge_end = member_hinge;
            mem_num++;
        };
    };


    for (var j = 0; j < 2; ++j) {
        // Creating the first arc
        Member(mem_num, [j * 3 * n, n + 2 + j * 3 * n], "", top_chord);
        lines[mem_num].type = model.lines.TYPE_PARABOLA;
        lines[mem_num].parabola_first_node = nodes[j * 3 * n];
        lines[mem_num].parabola_control_point = $V(nodes[n + 1 + j * 3 * n].global_coordinate_1, nodes[n + 1 + j * 3 * n].global_coordinate_2, nodes[n + 1 + j * 3 * n].global_coordinate_3);
        lines[mem_num].parabola_second_node = nodes[n + 2 + j * 3 * n];
        mem_num++;

        // Top chord
        for (var i = 0; i < n - 2; ++i) {
            Member(mem_num, [n + 2 + j * 3 * n + 2 * i, n + 4 + j * 3 * n + 2 * i], "", top_chord);
            lines[mem_num].type = model.lines.TYPE_PARABOLA;
            lines[mem_num].parabola_first_node = nodes[n + 2 + j * 3 * n + 2 * i];
            lines[mem_num].parabola_control_point = $V(nodes[n + 3 + j * 3 * n + 2 * i].coordinate_1, nodes[n + 3 + j * 3 * n + 2 * i].coordinate_2, nodes[n + 3 + j * 3 * n + 2 * i].coordinate_3);
            lines[mem_num].parabola_second_node = nodes[n + 4 + j * 3 * n + 2 * i];
            mem_num++;
        };

        // Creating the last arc
        Member(mem_num, [3 * n - 2 + j * 3 * n, n + j * 3 * n], "", top_chord);
        lines[mem_num].type = model.lines.TYPE_PARABOLA;
        lines[mem_num].parabola_first_node = nodes[3 * n - 2 + j * 3 * n];
        lines[mem_num].parabola_control_point = $V(nodes[3 * n - 1 + j * 3 * n].coordinate_1, nodes[3 * n - 1 + j * 3 * n].coordinate_2, nodes[3 * n - 1 + j * 3 * n].coordinate_3);
        lines[mem_num].parabola_second_node = nodes[n + j * 3 * n];
        mem_num++;
    };

    // Creating diagonals
    for (var j = 0; j < 2; ++j) {
        if (n / 2 % 2 == 0) {
            for (var i = 0; i < n / 2 - 1; ++i) {
                Member(mem_num, [1 + j * 3 * n + 2 * i, n + 4 + j * 3 * n + 4 * i], "", diagonals);
                members[mem_num].member_hinge_start = member_hinge;
                members[mem_num].member_hinge_end = member_hinge;
                mem_num++;
                Member(mem_num, [3 + j * 3 * n + 2 * i, n + 4 + j * 3 * n + 4 * i], "", diagonals);
                members[mem_num].member_hinge_start = member_hinge;
                members[mem_num].member_hinge_end = member_hinge;
                mem_num++;
            };
        }
        else {
            for (var i = 0; i < n / 2 - 1; ++i) {
                Member(mem_num, [2 + j * 3 * n + 2 * i, n + 2 + j * 3 * n + 4 * i], "", top_chord);
                members[mem_num].member_hinge_start = member_hinge;
                members[mem_num].member_hinge_end = member_hinge;
                mem_num++;
                Member(mem_num, [2 + j * 3 * n + 2 * i, n + 6 + j * 3 * n + 4 * i], "", top_chord);
                members[mem_num].member_hinge_start = member_hinge;
                members[mem_num].member_hinge_end = member_hinge;
                mem_num++;
            };
        }
    };

    // Creating deck beams
    MemberEccentricity(1);
    member_eccentricities[1].specification_type = model.member_eccentricities.TYPE_RELATIVE;
    member_eccentricities[1].vertical_section_alignment = model.member_eccentricities.ALIGN_TOP;
    member_eccentricities[1].horizontal_section_alignment = model.member_eccentricities.ALIGN_MIDDLE;

    for (var i = 0; i < n + 1; ++i) {
        Member(mem_num, [i, 3 * n + i], "", deck);
        members[mem_num].member_eccentricity_start = member_eccentricities[1];
        members[mem_num].member_eccentricity_end = member_eccentricities[1];
        mem_num++;
    };

    // Creating bracing
    for (var i = 0; i < n - 1; ++i) {
        if (min_height == true && -nodes[n + 2 + 2 * i].coordinate_3 < h_m) { continue; };
        Member(mem_num, [n + 2 + 2 * i, 3 * n + n + 2 + 2 * i], "", bracing);
        mem_num++;
    };

    // Creating deck lines and surface
    Line(mem_num, [0, n]);
    mem_num++;
    Line(mem_num, [3 * n, 4 * n]);
    mem_num++;
    Line(mem_num, [0, 3 * n]);
    mem_num++;
    Line(mem_num, [n, 4 * n]);

    Surface(0, [lines[mem_num], lines[mem_num - 1], lines[mem_num - 2], lines[mem_num - 3]]).type = model.surfaces.TYPE_STANDARD;
    surfaces[0].geometry = model.surfaces.GEOMETRY_PLANE;
    surfaces[0].thickness = thicknesses[1];

    // assign supports to nodes 
    nodes[0].support = nodal_supports[1];
    nodes[3 * n].support = nodal_supports[1];
    nodes[n].support = nodal_supports[2];
    nodes[4 * n].support = nodal_supports[2];

    //
    // Create dimensions
    // coordinate system for all dimensions
    var coordinate_system_params_3 =
    {
        "origin_coordinates": [0.000, 0.000, 0.000],
        "u_axis_point_coordinates": [1, 0.000, 0.000],
        "uw_plane_point_coordinates": [0.000, 0.000, 1]
    }
    CoordinateSystem(3, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params_3);

    var linear_dimension_params_1 =
    {
        "linear_coordinate_system": coordinate_systems[3],
    };

    // x dimensions
    LinearDimension(undefined, nodes[3 * n], nodes[4 * n], "xy", "L", W + 1, "", linear_dimension_params_1);

    // y dimensions
    LinearDimension(undefined, nodes[n], nodes[4 * n], "yx", "W", L + 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[2 * n], nodes[5 * n], "yz", "W<sub>1</sub>", -H - 1, "", linear_dimension_params_1);

    // z dimensions
    LinearDimension(undefined, nodes[n], nodes[2 * n], "zx", "H", L + 1, "", linear_dimension_params_1);
}