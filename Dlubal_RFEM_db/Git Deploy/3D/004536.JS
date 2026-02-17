function input_data() {
    category("Basic Data");
    parameter_int("Number of bays", "n", "", 14, UNIT.NONE, 4, 2, 50, true, true);

    category("Geometry");
    parameter_float("Length", "L", "", 24, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Width", "W", "", 2.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);

    parameter_float("Height", "H", "", 8, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Height 1", "H_1", "H<sub>1</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance 1", "d_1", "d<sub>1</sub>", 1.6, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance 2", "d_2", "d<sub>2</sub>", 5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Distance 3", "d_3", "d<sub>3</sub>", 7, UNIT.LENGTH, 0, 0.1, NAN, false, false);

    category("Materials &amp; Sections");
    section(1, "Posts");
    section(2, "Deck");
    section(3, "Cables");

    category("Materials & Thicknesses");
    thickness(1, "Deck");

    category("Supports");
    nodal_support(1, "Nodal support | Posts");
    nodal_support(2, "Nodal support");
}

function generate() {
    ASSERT(n % 2 == 0, "n should be even");

    //
    // Create structure
    //

    // create nodes
    Node(0, -L / 2, -W / 2, -H_1);
    Node(1, L / 2, -W / 2, -H_1);
    Node(2, -L / 2, W / 2, -H_1);
    Node(3, L / 2, W / 2, -H_1);

    var num_node = 4;

    for (var i = 1; i < n; ++i) {
        Node(num_node);
        nodes[num_node].type = model.nodes.TYPE_BETWEEN_TWO_NODES;
        nodes[num_node].between_two_nodes_start_node = nodes[0];
        nodes[num_node].between_two_nodes_end_node = nodes[1];
        nodes[num_node].distance_from_start_absolute = i * L / n;
        num_node++;
    };

    for (var i = 1; i < n; ++i) {
        Node(num_node);
        nodes[num_node].type = model.nodes.TYPE_BETWEEN_TWO_NODES;
        nodes[num_node].between_two_nodes_start_node = nodes[2];
        nodes[num_node].between_two_nodes_end_node = nodes[3];
        nodes[num_node].distance_from_start_absolute = i * L / n;
        num_node++;
    };

    var post_ref = num_node;

    Node(num_node, 0, -d_1 / 2, 0);
    num_node++;
    Node(num_node, 0, -d_1 / 2 - H_1 * ((d_3 - d_1) / 2) / H, -H_1);
    num_node++;
    Node(num_node, 0, -d_3 / 2, -H);
    num_node++;
    Node(num_node, 0, -d_1 / 2 - d_2, 0);
    num_node++;

    Node(num_node, 0, d_1 / 2, 0);
    num_node++;
    Node(num_node, 0, d_1 / 2 + H_1 * ((d_3 - d_1) / 2) / H, -H_1);
    num_node++;
    Node(num_node, 0, d_3 / 2, -H);
    num_node++;
    Node(num_node, 0, d_1 / 2 + d_2, 0);
    num_node++;

    // Create members
    var post = {
        "section_start": sections[1],
        "type": model.members.TYPE_BEAM
    };
    var deck = {
        "section_start": sections[2],
        "type": model.members.TYPE_BEAM
    };
    var cables = {
        "section_start": sections[3],
        "type": model.members.TYPE_CABLE
    };

    var mem_num = 0;

    // Deck support members
    // x direction

    var mem_num = 0
    Member(mem_num, [0, 4], "", deck);
    members[mem_num].rotation_angle = PI;
    mem_num++;
    for (var i = 0; i < n - 2; ++i) {
        Member(mem_num, [4 + i, 5 + i], "", deck);
        members[mem_num].rotation_angle = PI;
        mem_num++;
    };
    Member(mem_num, [n + 2, 1], "", deck);
    members[mem_num].rotation_angle = PI;
    mem_num++;

    Member(mem_num, [2, n + 3], "", deck);
    members[mem_num].rotation_angle = PI;
    mem_num++;
    for (var i = 0; i < n - 2; ++i) {
        Member(mem_num, [n + 3 + i, n + 4 + i], "", deck);
        members[mem_num].rotation_angle = PI;
        mem_num++;
    };
    Member(mem_num, [2 * n + 1, 3], "", deck);
    members[mem_num].rotation_angle = PI;
    mem_num++;

    // y direction
    Member(mem_num, [0, 2], "", deck);
    members[mem_num].rotation_angle = PI;
    mem_num++;
    for (var i = 0; i < n - 1; ++i) {
        Member(mem_num, [4 + i, n + 3 + i], "", deck);
        members[mem_num].rotation_angle = PI;
        mem_num++;
    };
    Member(mem_num, [1, 3], "", deck);
    members[mem_num].rotation_angle = PI;
    mem_num++;

    // Post
    Member(mem_num, [post_ref, post_ref + 1], "", post);
    mem_num++;
    Member(mem_num, [post_ref + 1, post_ref + 2], "", post);
    mem_num++;
    Member(mem_num, [post_ref + 4, post_ref + 5], "", post);
    mem_num++;
    Member(mem_num, [post_ref + 5, post_ref + 6], "", post);
    mem_num++;

    Member(mem_num, [post_ref + 3, post_ref + 2], "", cables);
    mem_num++;
    Member(mem_num, [post_ref + 7, post_ref + 6], "", cables);
    mem_num++;
    Member(mem_num, [post_ref + 2, post_ref + 6], "", cables);
    mem_num++;

    MemberEccentricity(1);
    member_eccentricities[1].specification_type = model.member_eccentricities.TYPE_RELATIVE;
    member_eccentricities[1].vertical_section_alignment = model.member_eccentricities.ALIGN_TOP;
    member_eccentricities[1].horizontal_section_alignment = model.member_eccentricities.ALIGN_MIDDLE;
    member_eccentricities[1].transverse_offset_active = true;
    member_eccentricities[1].transverse_offset_reference_type = model.member_eccentricities.TRANSVERSE_OFFSET_TYPE_FROM_MEMBER_SECTION;
    member_eccentricities[1].transverse_offset_reference_member = members[0];
    member_eccentricities[1].transverse_offset_vertical_alignment = model.member_eccentricities.ALIGN_TOP;
    member_eccentricities[1].transverse_offset_horizontal_alignment = model.member_eccentricities.ALIGN_MIDDLE;

    Member(mem_num, [post_ref + 1, post_ref + 5], "", post);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;

    // Create cables
    Member(mem_num, [post_ref + 2, 0], "", cables);
    mem_num++;
    Member(mem_num, [post_ref + 2, 1], "", cables);
    mem_num++;
    Member(mem_num, [post_ref + 6, 2], "", cables);
    mem_num++;
    Member(mem_num, [post_ref + 6, 3], "", cables);
    mem_num++;

    for (var i = 0; i < n - 1; ++i) {
        if (i == n / 2 - 1) { continue; };
        Member(mem_num, [post_ref + 2, 4 + i], "", cables);
        mem_num++;
        Member(mem_num, [post_ref + 6, n + 3 + i], "", cables);
        mem_num++;
    };

    // Create deck surface
    for (var i = 0; i < n; ++i) {
        Surface(i, [lines[i], lines[n + i], lines[2 * n + i], lines[2 * n + i + 1]]).type = model.surfaces.TYPE_STANDARD;
        surfaces[i].geometry = model.surfaces.GEOMETRY_PLANE;
        surfaces[i].thickness = thicknesses[1];
    };

    // assign supports to nodes 
    nodes[post_ref].support = nodal_supports[1];
    nodes[post_ref + 4].support = nodal_supports[1];
    nodes[post_ref + 3].support = nodal_supports[2];
    nodes[post_ref + 7].support = nodal_supports[2];
    nodes[0].support = nodal_supports[2];
    nodes[1].support = nodal_supports[2];
    nodes[2].support = nodal_supports[2];
    nodes[3].support = nodal_supports[2];

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
    LinearDimension(undefined, nodes[2], nodes[3], "xz", "L", -H_1 + 1, "", linear_dimension_params_1);

    // y dimensions
    LinearDimension(undefined, nodes[1], nodes[3], "yx", "W", L / 2 + 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[post_ref], nodes[post_ref + 4], "yx", "d<sub>1</sub>", 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[post_ref], nodes[post_ref + 3], "yx", "d<sub>2</sub>", 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[post_ref + 4], nodes[post_ref + 7], "yx", "d<sub>2</sub>", 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[post_ref + 2], nodes[post_ref + 6], "yz", "d<sub>3</sub>", -H - 1, "", linear_dimension_params_1);

    // z dimensions
    LinearDimension(undefined, nodes[post_ref + 7], nodes[post_ref + 5], "zy", "H<sub>1</sub>", d_1 / 2 + d_2 + 1, "", linear_dimension_params_1);
    LinearDimension(undefined, nodes[post_ref + 7], nodes[post_ref + 6], "zy", "H", d_1 / 2 + d_2 + 2, "", linear_dimension_params_1);
}