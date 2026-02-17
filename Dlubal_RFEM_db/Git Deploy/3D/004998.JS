function input_data() {
    category("Basic data");
    parameter_int("Number of bays | Bottom", "n_b", "n<sub>b</sub>", 14, UNIT.NONE, 1, 2, 50, true, true);
    parameter_int("Number of bays | Top", "n_t", "n<sub>t</sub>", 4, UNIT.NONE, 1, 2, 50, true, true);
    parameter_int("Number of bays | Sides", "n_l", "n<sub>l</sub>", 6, UNIT.NONE, 2, 2, 50, true, true);

    var GEOMETRY = category("Geometry");
    parameter_float("Height", "H_b", "H<sub>b</sub>", 31, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);
    parameter_float("Height", "H_t", "H<sub>t</sub>", 6.8, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);
    parameter_float("Height 1", "H_1", "H<sub>1</sub>", 0.4, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Height 2", "H_2", "H<sub>2</sub>", 1.7, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Width 1", "b_1", "b<sub>1</sub>", 3.4, UNIT.LENGTH, 0, 0.1, NAN, true, false);
    parameter_float("Width 2", "b_2", "b<sub>2</sub>", 1.3, UNIT.LENGTH, 0, 0.1, NAN, true, false);
    parameter_float("Width 3", "b_3", "b<sub>3</sub>", 0.4, UNIT.LENGTH, 0, 0.1, NAN, true, false);
    parameter_float("Length", "L", "", 7, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance", "d", "", 0.4, UNIT.LENGTH, 0, 0.1, NAN, true, false);

    category("Section heights | Bottom", "", GEOMETRY);
    parameter_float("Height {{number}}", "h_b", "H<sub>b{{number}}</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, false, false, "n_b");
    category("Section heights | Top", "", GEOMETRY);
    parameter_float("Height {{number}}", "h_t", "H<sub>t{{number}}</sub>", 1.8, UNIT.LENGTH, 0, 0.1, NAN, false, false, "n_t");

    var SECTION = category("Sections");
    category("Lower part", "", SECTION);
    section(1, "Legs");
    section(2, "Diagonals");
    section(3, "Horizontals");

    category("Upper part", "", SECTION);
    section(4, "Legs");
    section(5, "Diagonals");
    section(6, "Horizontals");

    category("Arms", "", SECTION);
    section(7, "Legs");
    section(8, "Diagonals");
    section(9, "Horizontals");

    category("Supports");
    nodal_support(1, "Nodal supports");
}

function generate() {
    ASSERT(n_l % 2 == 0, "n<sub>l</sub> should be even");

    var calculated_parameters = {};

    var H_b = 0;
    for (i = 0; i < n_b; ++i) {
        H_b = H_b + eval("h_b_" + (i + 1));
    }
    calculated_parameters["H_b"] = H_b;

    var H_t = 0;
    for (i = 0; i < n_t; ++i) {
        H_t = H_t + eval("h_t_" + (i + 1));
    }
    calculated_parameters["H_t"] = H_t;

    var alpha_1 = atan(((b_1 - b_2) / 2) / (H_b + H_1 + H_2));
    var alpha_2 = atan(((b_2 - b_3) / 2) / H_t);

    //
    // Create structure
    // 
    var num_node = 0;

    Node(num_node, 0, 0, 0);
    num_node++;
    Node(num_node, b_1, 0, 0);
    num_node++;
    Node(num_node, b_1, b_1, 0);
    num_node++;
    Node(num_node, 0, b_1, 0);
    num_node++;

    var dist = 0;
    var height = H_1;
    for (i = 0; i < n_b + 1; ++i) {
        dist = height * tan(alpha_1);
        Node(num_node, dist, dist, -height);
        num_node++;
        Node(num_node, b_1 - dist, dist, -height);
        num_node++;
        Node(num_node, b_1 - dist, b_1 - dist, -height);
        num_node++;
        Node(num_node, dist, b_1 - dist, -height);
        num_node++;

        if (i == n_b) { break; };
        height = height + eval("h_b_" + (i + 1)) / 2;

        dist = height * tan(alpha_1);
        Node(num_node, dist, dist, -height);
        num_node++;
        Node(num_node, b_1 - dist, dist, -height);
        num_node++;
        Node(num_node, b_1 - dist, b_1 - dist, -height);
        num_node++;
        Node(num_node, dist, b_1 - dist, -height);
        num_node++;
        height = height + eval("h_b_" + (i + 1)) / 2;
    };

    var node_ref_center = num_node;

    height = height + H_2 / 2;
    dist = height * tan(alpha_1);
    Node(num_node, dist, dist, -height);
    num_node++;
    Node(num_node, b_1 - dist, dist, -height);
    num_node++;
    Node(num_node, b_1 - dist, b_1 - dist, -height);
    num_node++;
    Node(num_node, dist, b_1 - dist, -height);
    num_node++;

    var height_2 = 0
    for (i = 0; i < n_t + 1; ++i) {
        dist = height_2 * tan(alpha_2);
        Node(num_node, b_1 / 2 - b_2 / 2 + dist, b_1 / 2 - b_2 / 2 + dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;
        Node(num_node, b_1 / 2 + b_2 / 2 - dist, b_1 / 2 - b_2 / 2 + dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;
        Node(num_node, b_1 / 2 + b_2 / 2 - dist, b_1 / 2 + b_2 / 2 - dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;
        Node(num_node, b_1 / 2 - b_2 / 2 + dist, b_1 / 2 + b_2 / 2 - dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;

        if (i == n_t) { break; };
        height_2 = height_2 + eval("h_t_" + (i + 1)) / 2;

        dist = height_2 * tan(alpha_2);
        Node(num_node, b_1 / 2 - b_2 / 2 + dist, b_1 / 2 - b_2 / 2 + dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;
        Node(num_node, b_1 / 2 + b_2 / 2 - dist, b_1 / 2 - b_2 / 2 + dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;
        Node(num_node, b_1 / 2 + b_2 / 2 - dist, b_1 / 2 + b_2 / 2 - dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;
        Node(num_node, b_1 / 2 - b_2 / 2 + dist, b_1 / 2 + b_2 / 2 - dist, -height_2 - (H_1 + H_b + H_2));
        num_node++;

        height_2 = height_2 + eval("h_t_" + (i + 1)) / 2;
    };

    var node_ref_diagonals_1 = num_node;

    var dist = 0;
    var height = H_1;
    for (i = 0; i < n_b + 1; ++i) {
        dist = height * tan(alpha_1);
        Node(num_node, b_1 / 2, dist, -height);
        num_node++;
        Node(num_node, b_1 / 2, b_1 - dist, -height);
        num_node++;

        if (i == n_b) { break; };
        height = height + eval("h_b_" + (i + 1)) / 2;

        dist = height * tan(alpha_1);
        Node(num_node, dist, b_1 / 2, -height);
        num_node++;
        Node(num_node, b_1 - dist, b_1 / 2, -height);
        num_node++;

        height = height + eval("h_b_" + (i + 1)) / 2;
    };

    height = height + H_2 / 2;
    dist = height * tan(alpha_1);
    Node(num_node, dist, b_1 / 2, -height);
    num_node++;
    Node(num_node, b_1 - dist, b_1 / 2, -height);
    num_node++;

    var node_ref_diagonals_2 = num_node;

    var height_2 = 0
    dist = height_2 * tan(alpha_2);
    Node(num_node, b_1 / 2, b_1 / 2 - b_2 / 2 + dist, -height_2 - (H_1 + H_b + H_2));
    num_node++;
    Node(num_node, b_1 / 2, b_1 / 2 + b_2 / 2 - dist, -height_2 - (H_1 + H_b + H_2));
    num_node++;

    var ref_wing_1 = num_node;
    var s = nodes[node_ref_center - 2].coordinate_1 - nodes[node_ref_center - 1].coordinate_1;
    var s_2 = nodes[node_ref_center + 5].coordinate_1 - nodes[node_ref_center + 4].coordinate_1;
    var teta = atan(H_2 / (L + ((s - s_2) / 2)));

    for (i = 1; i < n_l + 1; ++i) {
        Node(num_node, nodes[node_ref_center - 2].coordinate_1 + i * L / n_l, nodes[node_ref_center - 2].coordinate_2 - i * ((s - d) / 2) / n_l, -H_1 - H_b);
        num_node++;
        Node(num_node, nodes[node_ref_center - 3].coordinate_1 + i * L / n_l, nodes[node_ref_center - 3].coordinate_2 + i * ((s - d) / 2) / n_l, -H_1 - H_b);
        num_node++;

        if (i == n_l) { break; };

        Node(num_node, nodes[node_ref_center - 2].coordinate_1 + i * L / n_l,
            nodes[node_ref_center + 6].coordinate_2 - i * ((s_2 - d) / 2) / n_l,
            -H_1 - H_b - H_2 + (((s - s_2) / 2) + i * L / n_l) * tan(teta));
        num_node++;
        Node(num_node, nodes[node_ref_center - 3].coordinate_1 + i * L / n_l,
            nodes[node_ref_center + 5].coordinate_2 + i * ((s_2 - d) / 2) / n_l,
            -H_1 - H_b - H_2 + (((s - s_2) / 2) + i * L / n_l) * tan(teta));
        num_node++;
    };

    var ref_wing_2 = num_node;

    for (i = 1; i < n_l + 1; ++i) {
        Node(num_node, nodes[node_ref_center - 1].coordinate_1 - i * L / n_l, nodes[node_ref_center - 1].coordinate_2 - i * ((s - d) / 2) / n_l, -H_1 - H_b);
        num_node++;
        Node(num_node, nodes[node_ref_center - 4].coordinate_1 - i * L / n_l, nodes[node_ref_center - 4].coordinate_2 + i * ((s - d) / 2) / n_l, -H_1 - H_b);
        num_node++;

        if (i == n_l) { break; };

        Node(num_node, nodes[node_ref_center - 4].coordinate_1 - i * L / n_l,
            nodes[node_ref_center + 7].coordinate_2 - i * ((s_2 - d) / 2) / n_l,
            -H_1 - H_b - H_2 + (((s - s_2) / 2) + i * L / n_l) * tan(teta));
        num_node++;
        Node(num_node, nodes[node_ref_center - 4].coordinate_1 - i * L / n_l,
            nodes[node_ref_center + 4].coordinate_2 + i * ((s_2 - d) / 2) / n_l,
            -H_1 - H_b - H_2 + (((s - s_2) / 2) + i * L / n_l) * tan(teta));
        num_node++;
    };

    var center_node = num_node;
    Node(num_node, b_1 / 2, b_1 / 2, -H_1 - H_b);
    num_node++;

    var center_node_2 = num_node;
    Node(num_node, b_1 / 2, b_1 / 2 - b_3 / 2, -H_1 - H_b - H_2 - H_t);
    num_node++;
    Node(num_node, b_1 / 2, b_1 / 2 + b_3 / 2, -H_1 - H_b - H_2 - H_t);
    num_node++;

    // define a hinge
    var hinges_params_1 =
    {
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO,
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO
    };

    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinges_params_1);

    // create members  
    var legs = {
        "section_start": sections[1],
        "type": model.members.TYPE_BEAM
    };
    var diagonals = {
        "section_start": sections[2],
        "type": model.members.TYPE_BEAM
    };
    var horizontals = {
        "section_start": sections[3],
        "type": model.members.TYPE_BEAM,
        "member_hinge_start": member_hinge,
        "member_hinge_end": member_hinge
    };

    var legs_top = {
        "section_start": sections[4],
        "type": model.members.TYPE_BEAM
    };
    var diagonals_top = {
        "section_start": sections[5],
        "type": model.members.TYPE_BEAM
    };
    var horizontals_top = {
        "section_start": sections[6],
        "type": model.members.TYPE_BEAM,
        "member_hinge_start": member_hinge,
        "member_hinge_end": member_hinge
    };

    var legs_arm = {
        "section_start": sections[7],
        "type": model.members.TYPE_BEAM
    };
    var diagonals_arm = {
        "section_start": sections[8],
        "type": model.members.TYPE_BEAM
    };
    var horizontals_arm = {
        "section_start": sections[9],
        "type": model.members.TYPE_BEAM,
        "member_hinge_start": member_hinge,
        "member_hinge_end": member_hinge
    };

    var mem_num = 0;
    // Legs in main Tower
    for (var j = 0; j < 4; ++j) {
        for (var i = 0; i < 2 * (n_b + n_t) + 3; ++i) {
            if (i > 2 * n_b + 2) {
                Member(mem_num, [4 * i + j, 4 * i + 4 + j], "", legs_top);
            }
            else {
                Member(mem_num, [4 * i + j, 4 * i + 4 + j], "", legs);
            };
            members[mem_num].rotation_angle = PI / 2 + PI / 4;
            mem_num++;
        };
    };

    // Chords in the wings | Right
    Member(mem_num, [node_ref_center - 3, ref_wing_1 + 1], "", legs_arm);
    members[mem_num].rotation_angle = PI / 2;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center + 5, ref_wing_1 + 3], "", legs_arm);
    members[mem_num].rotation_angle = PI / 2;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center - 2, ref_wing_1], "", legs_arm);
    members[mem_num].rotation_angle = PI;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center + 6, ref_wing_1 + 2], "", legs_arm);
    members[mem_num].rotation_angle = PI;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;

    for (var i = 0; i < n_l - 1; ++i) {
        Member(mem_num, [ref_wing_1 + 1 + 4 * i, ref_wing_1 + 5 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;
        Member(mem_num, [ref_wing_1 + 4 * i, ref_wing_1 + 4 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;

        if (i == n_l - 2) {
            Member(mem_num, [ref_wing_1 + 3 + 4 * i, ref_wing_1 + 5 + 4 * i], "", legs_arm);
            members[mem_num].rotation_angle = PI / 2;
            members[mem_num].member_hinge_end = member_hinge;
            mem_num++;
            Member(mem_num, [ref_wing_1 + 2 + 4 * i, ref_wing_1 + 4 + 4 * i], "", legs_arm);
            members[mem_num].rotation_angle = PI;
            members[mem_num].member_hinge_end = member_hinge;
            mem_num++;
            break;
        };

        Member(mem_num, [ref_wing_1 + 3 + 4 * i, ref_wing_1 + 7 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;
        Member(mem_num, [ref_wing_1 + 2 + 4 * i, ref_wing_1 + 6 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;
    };

    // Chords in the wings | Left
    Member(mem_num, [node_ref_center - 4, ref_wing_2 + 1], "", legs_arm);
    members[mem_num].rotation_angle = PI;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center + 4, ref_wing_2 + 3], "", legs_arm);
    members[mem_num].rotation_angle = PI;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center - 1, ref_wing_2], "", legs_arm);
    members[mem_num].rotation_angle = PI / 2;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center + 7, ref_wing_2 + 2], "", legs_arm);
    members[mem_num].rotation_angle = PI / 2;
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;

    for (var i = 0; i < n_l - 1; ++i) {
        Member(mem_num, [ref_wing_2 + 1 + 4 * i, ref_wing_2 + 5 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;
        Member(mem_num, [ref_wing_2 + 4 * i, ref_wing_2 + 4 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;

        if (i == n_l - 2) {
            Member(mem_num, [ref_wing_2 + 3 + 4 * i, ref_wing_2 + 5 + 4 * i], "", legs_arm);
            members[mem_num].rotation_angle = PI;
            members[mem_num].member_hinge_end = member_hinge;
            mem_num++;
            Member(mem_num, [ref_wing_2 + 2 + 4 * i, ref_wing_2 + 4 + 4 * i], "", legs_arm);
            members[mem_num].rotation_angle = PI / 2;
            members[mem_num].member_hinge_end = member_hinge;
            mem_num++;
            break;
        };

        Member(mem_num, [ref_wing_2 + 3 + 4 * i, ref_wing_2 + 7 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;
        Member(mem_num, [ref_wing_2 + 2 + 4 * i, ref_wing_2 + 6 + 4 * i], "", legs_arm);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;
    };

    // Diagonals
    for (var i = 0; i < n_b + 1; ++i) {
        Member(mem_num, [node_ref_diagonals_1 + 4 * i, 8 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        if (i == 0) {
            members[mem_num].member_hinge_start = member_hinge;
        };
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [node_ref_diagonals_1 + 4 * i, 9 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [8 + 8 * i, node_ref_diagonals_1 + 4 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [9 + 8 * i, node_ref_diagonals_1 + 4 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        mem_num++;

        Member(mem_num, [node_ref_diagonals_1 + 1 + 4 * i, 11 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        if (i == 0) {
            members[mem_num].member_hinge_start = member_hinge;
        };
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [node_ref_diagonals_1 + 1 + 4 * i, 10 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [11 + 8 * i, node_ref_diagonals_1 + 5 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [10 + 8 * i, node_ref_diagonals_1 + 5 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        mem_num++;

        Member(mem_num, [4 + 8 * i, node_ref_diagonals_1 + 2 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [node_ref_diagonals_1 + 2 + 4 * i, 15 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [7 + 8 * i, node_ref_diagonals_1 + 2 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        mem_num++;
        Member(mem_num, [node_ref_diagonals_1 + 2 + 4 * i, 12 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        Member(mem_num, [6 + 8 * i, node_ref_diagonals_1 + 3 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [node_ref_diagonals_1 + 3 + 4 * i, 13 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [5 + 8 * i, node_ref_diagonals_1 + 3 + 4 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        mem_num++;
        Member(mem_num, [node_ref_diagonals_1 + 3 + 4 * i, 14 + 8 * i], "", diagonals);
        members[mem_num].rotation_angle = PI / 2;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
    };

    // Diagonals | Top part
    for (var i = 0; i < n_t; ++i) {
        Member(mem_num, [8 * (n_b + 1) + 4 + 8 * i, 8 * (n_b + 1) + 9 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [8 * (n_b + 1) + 9 + 8 * i, 8 * (n_b + 1) + 12 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        Member(mem_num, [8 * (n_b + 1) + 5 + 8 * i, 8 * (n_b + 1) + 10 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [8 * (n_b + 1) + 10 + 8 * i, 8 * (n_b + 1) + 13 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        Member(mem_num, [8 * (n_b + 1) + 6 + 8 * i, 8 * (n_b + 1) + 11 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [8 * (n_b + 1) + 11 + 8 * i, 8 * (n_b + 1) + 14 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        Member(mem_num, [8 * (n_b + 1) + 7 + 8 * i, 8 * (n_b + 1) + 8 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [8 * (n_b + 1) + 8 + 8 * i, 8 * (n_b + 1) + 15 + 8 * i], "", diagonals_top);
        members[mem_num].rotation_angle = PI;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
    };


    // Horizontals
    Member(mem_num, [4, 5], "", horizontals);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;
    Member(mem_num, [5, 6], "", horizontals);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;
    Member(mem_num, [6, 7], "", horizontals);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;
    Member(mem_num, [7, 4], "", horizontals);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;

    for (var i = 0; i < 2; ++i) {
        Member(mem_num, [node_ref_center - 4 + 8 * i, node_ref_center - 3 + 8 * i], "", horizontals);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;
        Member(mem_num, [node_ref_center - 3 + 8 * i, node_ref_center - 2 + 8 * i], "", horizontals);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;
        Member(mem_num, [node_ref_center - 2 + 8 * i, node_ref_center - 1 + 8 * i], "", horizontals);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;
        Member(mem_num, [node_ref_center - 1 + 8 * i, node_ref_center - 4 + 8 * i], "", horizontals);
        members[mem_num].rotation_angle = PI / 2;
        mem_num++;
    };

    Member(mem_num, [node_ref_diagonals_1 - 4, node_ref_diagonals_1 - 3], "", horizontals_top);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;
    Member(mem_num, [node_ref_diagonals_1 - 3, node_ref_diagonals_1 - 2], "", horizontals_top);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;
    Member(mem_num, [node_ref_diagonals_1 - 2, node_ref_diagonals_1 - 1], "", horizontals_top);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;
    Member(mem_num, [node_ref_diagonals_1 - 1, node_ref_diagonals_1 - 4], "", horizontals_top);
    members[mem_num].rotation_angle = PI / 2;
    mem_num++;


    // Verticals on wings | Right
    for (var i = 0; i < n_l; ++i) {
        Member(mem_num, [ref_wing_1 + 4 * i, ref_wing_1 + 1 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = 0;
        mem_num++;
        if (i == n_l - 1) { break; };
        Member(mem_num, [ref_wing_1 + 1 + 4 * i, ref_wing_1 + 3 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;
        Member(mem_num, [ref_wing_1 + 3 + 4 * i, ref_wing_1 + 2 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = PI - teta;
        mem_num++;
        Member(mem_num, [ref_wing_1 + 2 + 4 * i, ref_wing_1 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;
    };

    // Diagonals on wings | Right
    Member(mem_num, [node_ref_center + 5, ref_wing_1 + 1], "", diagonals_arm);
    members[mem_num].rotation_angle = 0;
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center + 6, ref_wing_1], "", diagonals_arm);
    members[mem_num].rotation_angle = -PI / 2;
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    for (var i = 0; i < n_l / 2 - 1; ++i) {
        Member(mem_num, [ref_wing_1 + 7 + 8 * i, ref_wing_1 + 1 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = -PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [ref_wing_1 + 6 + 8 * i, ref_wing_1 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = 0;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        Member(mem_num, [ref_wing_1 + 7 + 8 * i, ref_wing_1 + 9 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = 0;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [ref_wing_1 + 6 + 8 * i, ref_wing_1 + 8 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = -PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
    };

    // Verticals on wings | Left
    for (var i = 0; i < n_l; ++i) {
        Member(mem_num, [ref_wing_2 + 4 * i, ref_wing_2 + 1 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = 0;
        mem_num++;
        if (i == n_l - 1) { break; };
        Member(mem_num, [ref_wing_2 + 1 + 4 * i, ref_wing_2 + 3 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;
        Member(mem_num, [ref_wing_2 + 3 + 4 * i, ref_wing_2 + 2 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = PI - teta;
        mem_num++;
        Member(mem_num, [ref_wing_2 + 2 + 4 * i, ref_wing_2 + 4 * i], "", horizontals_arm);
        members[mem_num].rotation_angle = PI;
        mem_num++;
    };

    // Diagonals on wings | Left
    Member(mem_num, [node_ref_center + 4, ref_wing_2 + 1], "", diagonals_arm);
    members[mem_num].rotation_angle = 0;
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center + 7, ref_wing_2], "", diagonals_arm);
    members[mem_num].rotation_angle = -PI / 2;
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    for (var i = 0; i < n_l / 2 - 1; ++i) {
        Member(mem_num, [ref_wing_2 + 7 + 8 * i, ref_wing_2 + 1 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = -PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [ref_wing_2 + 6 + 8 * i, ref_wing_2 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = 0;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        Member(mem_num, [ref_wing_2 + 7 + 8 * i, ref_wing_2 + 9 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = 0;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
        Member(mem_num, [ref_wing_2 + 6 + 8 * i, ref_wing_2 + 8 + 8 * i], "", diagonals_arm);
        members[mem_num].rotation_angle = -PI / 2;
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
    };

    Member(mem_num, [node_ref_center - 4, center_node], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;
    Member(mem_num, [center_node, node_ref_center - 2], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;
    Member(mem_num, [node_ref_center - 1, center_node], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    mem_num++;
    Member(mem_num, [center_node, node_ref_center - 3], "", diagonals_arm);
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    // Horizontal diagonals on wings | Right
    Member(mem_num, [node_ref_center - 3, ref_wing_1], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    for (var i = 0; i < n_l / 2; ++i) {
        Member(mem_num, [ref_wing_1 + 8 * i, ref_wing_1 + 5 + 8 * i], "", diagonals_arm);
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        if (i == n_l / 2 - 1) { break; };

        Member(mem_num, [ref_wing_1 + 5 + 8 * i, ref_wing_1 + 8 + 8 * i], "", diagonals_arm);
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
    };

    // Horizontal diagonals on wings | Left
    Member(mem_num, [node_ref_center - 4, ref_wing_2], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;

    for (var i = 0; i < n_l / 2; ++i) {
        Member(mem_num, [ref_wing_2 + 8 * i, ref_wing_2 + 5 + 8 * i], "", diagonals_arm);
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;

        if (i == n_l / 2 - 1) { break; };

        Member(mem_num, [ref_wing_2 + 5 + 8 * i, ref_wing_2 + 8 + 8 * i], "", diagonals_arm);
        members[mem_num].member_hinge_start = member_hinge;
        members[mem_num].member_hinge_end = member_hinge;
        mem_num++;
    };

    Member(mem_num, [center_node_2, node_ref_diagonals_1 - 1], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;
    Member(mem_num, [center_node_2, node_ref_diagonals_1 - 2], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;
    Member(mem_num, [center_node_2, center_node_2 + 1], "", diagonals_arm);
    members[mem_num].member_hinge_start = member_hinge;
    members[mem_num].member_hinge_end = member_hinge;
    mem_num++;


    // Assign supports
    for (var i = 0; i < 4; ++i) {
        nodes[i].support = nodal_supports[1];
    };

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

    // x dimension
    LinearDimension(undefined, nodes[2], nodes[3], "xy", "b<sub>1</sub>", 1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;
    LinearDimension(undefined, nodes[8 * (n_b + 1) + 7], nodes[8 * (n_b + 1) + 6], "xy", "b<sub>2</sub>", 1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;
    LinearDimension(undefined, nodes[node_ref_diagonals_1 - 1], nodes[node_ref_diagonals_1 - 2], "xy", "b<sub>3</sub>", 1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;

    LinearDimension(undefined, nodes[8 * (n_b + 1) + 5], nodes[ref_wing_2 - 1], "xz", "L", -1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;
    LinearDimension(undefined, nodes[8 * (n_b + 1) + 4], nodes[center_node - 1], "xz", "L", -1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;

    // y dimension
    LinearDimension(undefined, nodes[ref_wing_2 - 1], nodes[ref_wing_2 - 2], "yx", "d", 1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;
    LinearDimension(undefined, nodes[center_node - 1], nodes[center_node - 2], "yx", "d", -1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;

    // z dimension
    LinearDimension(undefined, nodes[8 * (n_b + 1) + 6], nodes[ref_wing_2 - 2], "zx", "H<sub>2</sub>", 1, "", linear_dimension_params_1).is_global_dimension_line_offset = false;

    LinearDimension(undefined, [b_1, 0, 0], [b_1, 0, -H_1], "zx", "H<sub>1</sub>", b_1 + 1, "", linear_dimension_params_1);

    var height_t = H_1;
    for (var i = 0; i < n_b; ++i) {
        height_t = height_t + eval("h_b_" + (i + 1));
        LinearDimension(undefined, [b_1, 0, -height_t], [b_1, 0, -height_t + eval("h_b_" + (i + 1))], "zx", "H" + ("b" + (i + 1).toString()).sub(), b_1 + 1, "", linear_dimension_params_1);
    };

    var height_t = H_1 + H_b + H_2;
    for (var i = 0; i < n_t; ++i) {
        height_t = height_t + eval("h_t_" + (i + 1));
        LinearDimension(undefined, [b_1, 0, -height_t], [b_1, 0, -height_t + eval("h_t_" + (i + 1))], "zx", "H" + ("t" + (i + 1).toString()).sub(), b_1 + 1, "", linear_dimension_params_1);
    };
    LinearDimension(undefined, [b_1, 0, 0], [b_1, 0, -H_1], "zx", "H<sub>1</sub>", -1, "", linear_dimension_params_1);
    LinearDimension(undefined, [b_1, 0, -H_1], [b_1, 0, -H_1 - H_b], "zx", "H<sub>b</sub>", -1, "", linear_dimension_params_1);
    LinearDimension(undefined, [b_1, 0, -H_1 - H_b - H_2], [b_1, 0, -H_1 - H_b - H_2 - H_t], "zx", "H<sub>t</sub>", -1, "", linear_dimension_params_1);

    return calculated_parameters;
}