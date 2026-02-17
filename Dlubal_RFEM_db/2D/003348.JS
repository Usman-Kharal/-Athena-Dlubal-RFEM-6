function input_data() {
    category("Basic data");
    parameter_check("Symmetrical", "symmetrical", false);

    var GEOMETRY = category("Geometry");
    category("Heights", false, GEOMETRY);
    parameter_float("Height", "H", "", 4, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    parameter_float("Height 1", "H_1", "H<sub>1</sub>", 2.5, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    parameter_float("Height 2", "H_2", "H<sub>2</sub>", 2.5, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    condition("symmetrical == false");
    parameter_float("Height of middle curve", "H_0", "H<sub>0</sub>", 1.5, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    parameter_float("Height of curve 1", "H_01", "H<sub>01</sub>", 1, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    parameter_float("Height of curve 2", "H_02", "H<sub>02</sub>", 1, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    condition("symmetrical == false");

    category("Lengths", false, GEOMETRY);
    parameter_float("Length of middle span", "L", "", 6, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    parameter_float("Length 1", "L_1", "L<sub>1</sub>", 4, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    parameter_float("Length 2", "L_2", "L<sub>2</sub>", 4, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    condition("symmetrical == false");

    category("Materials &amp; Sections");
    section(1, "Inner columns");
    section(2, "Outer columns");
    section(3, "Middle curve");
    section(4, "Outer curves");

    category("Supports");
    nodal_support(1, "Nodal support");
}

function generate() {
    ASSERT(H_1 < H, "Height H<sub>1</sub> should be less than H");
    ASSERT(H_2 < H, "Height H<sub>2</sub> should be less than H");

    //
    // Create structure
    //
    if (symmetrical == true) {
        L_2 = L_1;
        H_2 = H_1;
        H_02 = H_01;
    };

    // create nodes
    Node(0, 0, 0, 0);
    Node(1, L_1, 0, 0);
    Node(2, L_1 + L, 0, 0);
    Node(3, L_1 + L + L_2, 0, 0);
    Node(4, 0, 0, -H_1);
    Node(5, L_1, 0, -H_1);
    Node(6, L_1, 0, -H);
    Node(7, L_1 + L, 0, -H);
    Node(8, L_1 + L, 0, -H_2);
    Node(9, L_1 + L + L_2, 0, -H_2);

    // create members 
    var section_1 = { "section_start": sections[1] };
    var section_2 = { "section_start": sections[2] };
    var section_3 = { "section_start": sections[3] };
    var section_4 = { "section_start": sections[4] };

    Member(0, [0, 4], "", section_2);
    members[0].type = model.members.TYPE_BEAM;
    Member(1, [1, 5], "", section_1);
    members[1].type = model.members.TYPE_BEAM;
    Member(2, [5, 6], "", section_1);
    members[2].type = model.members.TYPE_BEAM;
    Member(3, [2, 8], "", section_1);
    members[3].type = model.members.TYPE_BEAM;
    Member(4, [8, 7], "", section_1);
    members[4].type = model.members.TYPE_BEAM;
    Member(5, [3, 9], "", section_2);
    members[5].type = model.members.TYPE_BEAM;
    Member(6, [4, 5], "", section_4);
    members[6].type = model.members.TYPE_BEAM;
    lines[6].type = model.lines.TYPE_ARC;
    lines[6].arc_first_node = nodes[4];
    lines[6].arc_control_point = $V(L_1 / 2, 0.000, -H_1 - H_01);
    lines[6].arc_second_node = nodes[5];
    Member(7, [6, 7], "", section_3);
    members[7].type = model.members.TYPE_BEAM;
    lines[7].type = model.lines.TYPE_ARC;
    lines[7].arc_first_node = nodes[6];
    lines[7].arc_control_point = $V(L_1 + L / 2, 0.000, -H - H_0);
    lines[7].arc_second_node = nodes[7];
    Member(8, [8, 9], "", section_4);
    members[8].type = model.members.TYPE_BEAM;
    lines[8].type = model.lines.TYPE_ARC;
    lines[8].arc_first_node = nodes[8];
    lines[8].arc_control_point = $V(L_1 + L + L_2 / 2, 0.000, -H_2 - H_02);
    lines[8].arc_second_node = nodes[9];

    // assign support to nodes 
    nodes[0].support = nodal_supports[1];
    nodes[1].support = nodal_supports[1];
    nodes[2].support = nodal_supports[1];
    nodes[3].support = nodal_supports[1];

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
    LinearDimension(undefined, nodes[0], nodes[1], "xz", "L<sub>1</sub>", 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[1], nodes[2], "xz", "L", 1, "", linear_dimension_params_1);

    // z dimensions
    LinearDimension(undefined, nodes[0], nodes[4], "zx", "H<sub>1</sub>", -1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[4], [L_1 / 2, 0, -H_1 - H_01], "zx", "H<sub>01</sub>", -1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[0], nodes[6], "zx", "H", -2, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[6], [L_1 + L / 2, 0, -H - H_0], "zx", "H<sub>0</sub>", -2, "", linear_dimension_params_1);

    if (symmetrical == false) {
        LinearDimension(undefined, nodes[2], nodes[3], "xz", "L<sub>2</sub>", 1, "", linear_dimension_params_1);
        LinearDimension(undefined, nodes[3], nodes[9], "zx", "H<sub>2</sub>", L_1 + L + L_2 + 1, "", linear_dimension_params_1);
        LinearDimension(undefined, nodes[9], [L_1 + L + L_2 / 2, 0, -H_2 - H_02], "zx", "H<sub>02</sub>", L_1 + L + L_2 + 1, "", linear_dimension_params_1);
    }
    else {
        LinearDimension(undefined, nodes[2], nodes[3], "xz", "L<sub>1</sub>", 1, "", linear_dimension_params_1);
        LinearDimension(undefined, nodes[3], nodes[9], "zx", "H<sub>1</sub>", L_1 + L + L_2 + 1, "", linear_dimension_params_1);
        LinearDimension(undefined, nodes[9], [L_1 + L + L_2 / 2, 0, -H_2 - H_02], "zx", "H<sub>01</sub>", L_1 + L + L_2 + 1, "", linear_dimension_params_1);
    };
}