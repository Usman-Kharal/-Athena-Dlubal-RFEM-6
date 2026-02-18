function input_data() {
    category("Basic data");
    parameter_int("Number of bays", "n", "", 12, UNIT.NONE, 2, 1, 50, true, true);

    category("Geometry");

    parameter_float("Radius", "R", "", 20, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Length", "L", "", 20, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Height", "h", "", 1, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Width", "w", "", 1, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Angle", "alpha", "&alpha;", 1.0472, UNIT.ANGLE, 0, PI / 90, PI, false, false);
    editable_condition(false);
    parameter_float("Total height", "H", "", 1, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);

    category("Materials &amp; Sections");
    section(1, "Top chord");
    section(2, "Bottom chord");
    section(3, "Diagonals");
    section(4, "Verticals");
    section(5, "Horizontals");
}

function generate() {
    var calculated_parameters = {};
    var alpha = 2 * asin(L / (2 * R));
    var H = R - sqrt(sqr(R) - sqr(L) / 4);

    calculated_parameters["alpha"] = alpha;
    calculated_parameters["H"] = H;

    //
    // Create structure
    //
    // create nodes

    var beta = (PI - alpha) / 2;
    var coordinate_system_params =
    {
        "origin_coordinates": [0.000, 0.000, R * sin(beta)],
        "u_axis_point_coordinates": [1, 0.000, R * sin(beta)],
        "uw_plane_point_coordinates": [0.000, 0.000, R * sin(beta) + 1]
    }
    CoordinateSystem(1, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params);

    var num_node = 0;
    for (var j = 0; j < 2; ++j) {
        for (var i = 0; i < 4 * n + 1; ++i) {
            Node(num_node);
            nodes[num_node].coordinate_system = coordinate_systems[1];
            nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_Y_CYLINDRICAL;
            nodes[num_node].coordinates = $V(R, w * j, PI / 2 + beta + i * (alpha) / (4 * n));
            nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_CARTESIAN;
            num_node++;
        };
    };

    var top_node_ref = num_node;

    for (var i = 0; i < 4 * n + 1; ++i) {
        Node(num_node);
        nodes[num_node].coordinate_system = coordinate_systems[1];
        nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_Y_CYLINDRICAL;
        nodes[num_node].coordinates = $V(R + h, w / 2, PI / 2 + beta + i * (alpha) / (4 * n));
        nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_CARTESIAN;
        num_node++;
    };

    // create members
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
    var horizontals = {
        "section_start": sections[5],
        "type": model.members.TYPE_BEAM
    };

    var mem_num = 0;

    for (var i = 0; i < 2 * n; ++i) {
        // Bottom chord
        Member(mem_num, [2 * i, 2 * i + 2], "", bottom_chord);
        lines[mem_num].type = model.lines.TYPE_ARC;
        lines[mem_num].arc_first_node = nodes[2 * i];
        lines[mem_num].arc_control_point = $V(nodes[2 * i + 1].coordinate_1, nodes[2 * i + 1].coordinate_2, nodes[2 * i + 1].coordinate_3);
        lines[mem_num].arc_second_node = nodes[2 * i + 2];
        mem_num++;
        Member(mem_num, [2 * i + 4 * n + 1, 2 * i + 2 + 4 * n + 1], "", bottom_chord);
        lines[mem_num].type = model.lines.TYPE_ARC;
        lines[mem_num].arc_first_node = nodes[2 * i + 4 * n + 1];
        lines[mem_num].arc_control_point = $V(nodes[2 * i + 1 + 4 * n + 1].coordinate_1, nodes[2 * i + 1 + 4 * n + 1].coordinate_2, nodes[2 * i + 1 + 4 * n + 1].coordinate_3);
        lines[mem_num].arc_second_node = nodes[2 * i + 2 + 4 * n + 1];
        mem_num++;

        // Top chord
        Member(mem_num, [top_node_ref + 2 * i, top_node_ref + 2 * i + 2], "", top_chord);
        lines[mem_num].type = model.lines.TYPE_ARC;
        lines[mem_num].arc_first_node = nodes[top_node_ref + 2 * i];
        lines[mem_num].arc_control_point = $V(nodes[top_node_ref + 2 * i + 1].coordinate_1, nodes[top_node_ref + 2 * i + 1].coordinate_2, nodes[top_node_ref + 2 * i + 1].coordinate_3);
        lines[mem_num].arc_second_node = nodes[top_node_ref + 2 * i + 2];
        mem_num++;
    };

    for (var i = 0; i < 2 * n + 1; ++i) {
        // Verticals
        Member(mem_num, [2 * i, top_node_ref + 2 * i], "", verticals);
        mem_num++;
        Member(mem_num, [4 * n + 2 * i + 1, top_node_ref + 2 * i], "", verticals);
        mem_num++;
        // Horizontals
        Member(mem_num, [4 * n + 2 * i + 1, 2 * i], "", horizontals);
        mem_num++;
    };

    // Diagonals
    for (var i = 0; i < n; ++i) {
        Member(mem_num, [4 * i, top_node_ref + 4 * i + 2], "", diagonals);
        mem_num++;
        Member(mem_num, [4 * i + 4, top_node_ref + 4 * i + 2], "", diagonals);
        mem_num++;

        Member(mem_num, [4 * i + 4 * n + 1, top_node_ref + 4 * i + 2], "", diagonals);
        mem_num++;
        Member(mem_num, [4 * i + 4 + 4 * n + 1, top_node_ref + 4 * i + 2], "", diagonals);
        mem_num++;
    };

    // Create dimensions
    // coordinate system for all dimensions
    var coordinate_system_params_1 =
    {
        "origin_coordinates": [0.000, 0.000, 0.000],
        "u_axis_point_coordinates": [1, 0.000, 0.000],
        "uw_plane_point_coordinates": [0.000, 0.000, 1]
    }
    CoordinateSystem(2, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params_1);

    var linear_dimension_params_1 =
    {
        "linear_coordinate_system": coordinate_systems[2],
    };

    // x dimension
    LinearDimension(undefined, nodes[4 * n + 1], nodes[top_node_ref - 1], "xy", "L", w + 1, "", linear_dimension_params_1);

    // y dimension
    LinearDimension(undefined, nodes[0], nodes[4 * n + 1], "yx", "w", L / 2 + 1, "", linear_dimension_params_1);

    // z dimension
    LinearDimension(undefined, nodes[6 * n + 1], [0, w + 0.5, 0], "zy", "H", w + 0.5, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[6 * n + 1], nodes[10 * n + 2], "zy", "h", w + 0.5, "", linear_dimension_params_1);

    var reference_table = [
        [[0, w, R * sin(beta)], model.dimensions.REFERENCE_TYPE_POINT],
        [nodes[4 * n + 1], model.dimensions.REFERENCE_TYPE_NODE],
        [nodes[top_node_ref - 1], model.dimensions.REFERENCE_TYPE_NODE]
    ];

    AngularDimension(undefined, undefined, undefined, undefined, "&alpha;", 3 * R / 5, model.dimensions.ANGULAR_QUADRANT_POSITIVE, "", { 'reference_table': reference_table });

    return calculated_parameters;
}