function input_data() {
    category("Geometry");

    parameter_int("Number of bays", "n", "", 8, UNIT.NONE, 4, 2, 50, true, true);

    combobox("Input via", "input_via");
    combobox_value("L and L<sub>1</sub>", "define_L1");
    combobox_value("L and L<sub>2</sub>", "define_L2");
    combobox_value("L<sub>1</sub> and L<sub>2</sub>", "define_L1_L2", true);

    parameter_float("Total length", "L", "", 8, UNIT.LENGTH, .1, .1, 50, true, true);
    editable_condition("input_via == define_L1 || input_via == define_L2");

    parameter_float("Length of outer bays", "L_1", "L<sub>1</sub>", 1, UNIT.LENGTH, .1, .1, 50, true, true);
    editable_condition("input_via == define_L1 || input_via == define_L1_L2");

    parameter_float("Length of inner bays", "L_2", "L<sub>2</sub>", 1, UNIT.LENGTH, .1, .1, 50, true, true);
    editable_condition("input_via == define_L2 || input_via == define_L1_L2");

    parameter_float("Truss height", "H", "", 1.2, UNIT.LENGTH, 0.0, 0.1, 50, true, true);
    parameter_float("Bottom chord height", "H_1", "H<sub>1</sub>", 1, UNIT.LENGTH, 0.0, 0.1, 50, true, true);

    parameter_float("Bottom chord radius", "r_1", "r<sub>1</sub>", NaN, UNIT.LENGTH, 0.0, 1.0, 50, true, true);
    editable_condition(false);

    category("Materials &amp; Sections");
    section(1, "Top chord");
    section(2, "Bottom chord");
    section(3, "Diagonals");
    section(4, "Verticals");

    category("Supports");
    nodal_support(1, "Nodal support - left");
    nodal_support(2, "Nodal support - right");
}


function generate() {
    var calculated_parameters = {};

    ASSERT(n % 2 == 0, "Number of bays must be even");       // warns if the number of bays is odd

    if (input_via == "define_L1") {
        L_2 = (L - 2 * L_1) / (n - 2);
    }
    else if (input_via == "define_L2") {
        L_1 = (L - (n - 2) * L_2) / 2
    }
    else {
        L = (n - 2) * L_2 + 2 * L_1
    }

    r_1 = H_1 / 2 + sqr(L) / (8 * H_1);
    calculated_parameters["L_1"] = L_1;
    calculated_parameters["L_2"] = L_2;
    calculated_parameters["L"] = L;
    calculated_parameters["r_1"] = r_1;

    var member_set_bot = [];
    var member_set_top = [];

    //
    // Create structure
    //

    // create nodes
    for (var i = 0; i < 2 * n + 2; ++i) {
        Node(i)
    }
    nodes[0].coordinates = $V(0.000, 0.000, 0.000);   //  nodes of bottom chord
    for (var i = 1; i < n; ++i) {
        x = L_1 + (i - 1) * L_2;
        nodes[i].coordinates = $V(x, 0.000, -(sqrt(sqr(r_1) - sqr(x - L / 2)) + H_1 - r_1));
    }
    nodes[n].coordinates = $V(L, 0.000, 0.000);

    nodes[n + 1].coordinates = $V(0.000, 0.000, - H);   // nodes of upper chord     
    for (var i = n + 2; i < 2 * n + 1; ++i) {
        x = L_1 + (i - n - 2) * L_2;
        nodes[i].coordinates = $V(x, 0.000, -(sqrt(sqr(r_1) - sqr(x - L / 2)) + H_1 - r_1) - H);
    }
    nodes[2 * n + 1].coordinates = $V(L, 0.000, - H);

    // Creating member
    Member(0, [0, 1]);                                       // create the first bay of bottom chord
    members[0].section_start = sections[2];                  // assign cross-section to members
    members[0].rotation_angle = PI;                          // rotate the memebers by 180 degree

    lines[0].type = model.lines.TYPE_ARC;
    lines[0].arc_first_node = nodes[0];
    lines[0].arc_control_point = $V(L_1 / 2, 0.000, -(sqrt(sqr(r_1) - sqr(L_1 / 2 - L / 2)) + H_1 - r_1));
    lines[0].arc_second_node = nodes[1];
    member_set_bot.push(0);                                  // put the number of member in a list (array)

    for (var i = 1; i < n - 1; ++i)                          // bottom chord
    {
        Member(i, [i, i + 1]);                // creates also line i
        members[i].section_start = sections[2];
        members[i].rotation_angle = PI;

        lines[i].type = model.lines.TYPE_ARC;
        lines[i].arc_first_node = nodes[i];
        x = L_1 + L_2 / 2 + (i - 1) * L_2;
        lines[i].arc_control_point = $V(x, 0.000, -(sqrt(sqr(r_1) - sqr(x - L / 2)) + H_1 - r_1));
        lines[i].arc_second_node = nodes[i + 1];
        member_set_bot.push(i);
    }

    Member(n - 1, [n - 1, n]);                               // create the last bay of bottom chord
    members[n - 1].section_start = sections[2];
    members[n - 1].rotation_angle = PI;                      // rotate the memebers by 180 degree

    lines[n - 1].type = model.lines.TYPE_ARC;
    lines[n - 1].arc_first_node = nodes[n - 1];
    lines[n - 1].arc_control_point = $V(L - L_1 / 2, 0.000, -(sqrt(sqr(r_1) - sqr(L / 2 - L_1 / 2)) + H_1 - r_1));
    lines[n - 1].arc_second_node = nodes[n];
    member_set_bot.push(n - 1);

    var hinges_params_1 =                                         // define a hinge
    {
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO,
        "moment_release_mz": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO
    }

    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinges_params_1);     // member hinge

    var j = n;
    for (var i = 0; i < n + 1; ++i)                         // verticals
    {
        var member = Member(j, [i, n + i + 1]);
        members[j].section_start = sections[4];
        member.member_hinge_start = member_hinge;
        member.member_hinge_end = member_hinge;

        j = j + 1;
    }

    Member(j, [n + 1, n + 2]);                               // create the first bay of top chord
    members[j].section_start = sections[1];

    lines[j].type = model.lines.TYPE_ARC;
    lines[j].arc_first_node = nodes[n + 1];
    lines[j].arc_control_point = $V(L_1 / 2, 0.000, -(sqrt(sqr(r_1) - sqr(L_1 / 2 - L / 2)) + H_1 - r_1) - H);
    lines[j].arc_second_node = nodes[n + 2];
    member_set_top.push(j);

    j = j + 1;

    for (var i = 0; i < n - 2; ++i)                          // top chord
    {
        Member(j, [n + i + 2, n + i + 3]);
        members[j].section_start = sections[1];

        lines[j].type = model.lines.TYPE_ARC;
        lines[j].arc_first_node = nodes[n + i + 2];
        x = L_1 + L_2 / 2 + i * L_2;
        lines[j].arc_control_point = $V(x, 0.000, -(sqrt(sqr(r_1) - sqr(x - L / 2)) + H_1 - r_1) - H);
        lines[j].arc_second_node = nodes[n + i + 3];
        member_set_top.push(j);
        j = j + 1;
    }

    Member(j, [2 * n, 2 * n + 1]);                  // create the last bay of top chord
    members[j].section_start = sections[1];

    lines[j].type = model.lines.TYPE_ARC;
    lines[j].arc_first_node = nodes[2 * n];
    lines[j].arc_control_point = $V(L - L_1 / 2, 0.000, -(sqrt(sqr(r_1) - sqr(L / 2 - L_1 / 2)) + H_1 - r_1) - H);
    lines[j].arc_second_node = nodes[2 * n + 1];
    member_set_top.push(j);
    j = j + 1;

    if (n / 2 % 2 == 1)                                        // diagonals
    {
        for (var i = 0; i < n / 2; ++i) {
            member = Member(j, [2 * i, n + 2 * i + 2]);
            members[j].section_start = sections[3];
            member.member_hinge_start = member_hinge;
            member.member_hinge_end = member_hinge;

            member = Member(j + 1, [2 * i + 2, n + 2 * i + 2]);
            members[j + 1].section_start = sections[3];
            member.member_hinge_start = member_hinge;
            member.member_hinge_end = member_hinge;

            j = j + 2;
        }
    }
    else {
        for (var i = 0; i < n / 2; ++i) {
            member = Member(j, [2 * i + 1, n + 2 * i + 1]);
            members[j].section_start = sections[3];
            member.member_hinge_start = member_hinge;
            member.member_hinge_end = member_hinge;

            member = Member(j + 1, [2 * i + 1, n + 2 * i + 3]);
            members[j + 1].section_start = sections[3];
            member.member_hinge_start = member_hinge;
            member.member_hinge_end = member_hinge;

            j = j + 2;
        }
    }

    MemberSet(1, member_set_bot, "Bottom chord");            // make member set   
    MemberSet(2, member_set_top, "Top chord");

    // assign supports to nodes 
    nodes[0].support = nodal_supports[1];
    nodes[n].support = nodal_supports[2];

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

    for (var i = 0; i < n - 2; ++i) {
        LinearDimension(i, nodes[i + 1], nodes[i + 2], "xz", "L<sub>2</sub>", 1, "", linear_dimension_params_1);
    }
    LinearDimension(n - 2, nodes[0], nodes[1], "xz", "L<sub>1</sub>", 1, "", linear_dimension_params_1);
    LinearDimension(n - 1, nodes[n - 1], nodes[n], "xz", "L<sub>1</sub>", 1, "", linear_dimension_params_1);
    LinearDimension(n, nodes[0], nodes[n], "xz", "L", 1.5, "", linear_dimension_params_1);

    // z dimensions
    LinearDimension(n + 1, nodes[0], nodes[n / 2], "zx", "H<sub>1</sub>", L / 2, "", linear_dimension_params_1);
    LinearDimension(n + 2, nodes[0], nodes[n + 1], "zx", "H", -1, "", linear_dimension_params_1);

    return calculated_parameters;
}