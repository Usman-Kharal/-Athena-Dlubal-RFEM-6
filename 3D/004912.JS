function input_data() {
    var BASIC_DATA = category("Basic Data");
    parameter_int("Number of bays | Radial", "n_r", "n<sub>r</sub>", 12, UNIT.NONE, 4, 2, 50, true, true);
    parameter_int("Number of bays | Axial", "n_a", "n<sub>a</sub>", 20, UNIT.NONE, 4, 2, 50, true, true);
    parameter_int("Number of bays | Flat", "n_f", "n<sub>f</sub>", 8, UNIT.NONE, 4, 2, 50, true, true);

    var GEOMETRY = category("Geometry");
    parameter_float("Height 1", "H_1", "H<sub>1</sub>", 8, UNIT.LENGTH, 0.0, 0.1, 50, false, true);
    parameter_float("Radius 1", "r_t", "r<sub>t</sub>", 3.5, UNIT.LENGTH, 0.0, 0.1, 50, false, true);
    parameter_float("Radius 2", "r_b", "r<sub>b</sub>", 14, UNIT.LENGTH, 0.0, 0.1, 50, false, true);
    parameter_float("Radius 3", "r_m", "r<sub>m</sub>", 12, UNIT.LENGTH, 0.0, 0.1, 50, false, true);

    var SECTIONS = category("Materials & Sections");
    section(1, "Horizontals");
    section(2, "Verticals");
    section(3, "Diagonals");

    category("Supports");
    nodal_support(1, "Nodal support");
}
function generate() {
    // Create nodes  
    // Auxiliary nodes
    var num_node = 0;
    for (var i = 0; i < n_a + 1; ++i) {
        Node(num_node);
        nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_Y_CYLINDRICAL;
        nodes[num_node].coordinates = $V(r_b, 0, i * (PI / 2) / n_a + 3 * PI / 2);
        nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_CARTESIAN;
        nodes[num_node].coordinate_1 = nodes[num_node].coordinate_1 + r_b + r_t;
        nodes[num_node].coordinate_3 = nodes[num_node].coordinate_3 - r_b;
        num_node++;
    };

    var ref_node_0 = num_node;
    for (var i = 0; i < n_a + 3; ++i) {
        Node(num_node);
        nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_Y_CYLINDRICAL;
        nodes[num_node].coordinates = $V(r_m, 0, i * (PI / 2) / n_a + 3 * PI / 2);
        nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_CARTESIAN;
        nodes[num_node].coordinate_1 = nodes[num_node].coordinate_1 + r_m + r_t;
        nodes[num_node].coordinate_3 = nodes[num_node].coordinate_3 - r_b;
        num_node++;
    };

    // Curves
    var ref_node_1 = num_node;
    for (var j = 0; j < n_a + 1; ++j) {
        for (var i = 0; i < n_r; ++i) {
            Node(num_node);
            nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_Z_CYLINDRICAL;
            nodes[num_node].coordinates = $V(nodes[j].coordinate_1, i * 2 * PI / n_r, nodes[j].coordinate_3);
            num_node++;
        };
    };

    var ref_node_2 = num_node;
    for (var j = 0; j < n_a + 3; ++j) {
        for (var i = 0; i < n_r; ++i) {
            Node(num_node);
            nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_Z_CYLINDRICAL;
            nodes[num_node].coordinates = $V(nodes[n_a + 1 + j].coordinate_1, i * 2 * PI / n_r + PI / n_r, nodes[n_a + 1 + j].coordinate_3);
            num_node++;
        };
    };

    // Cylinder at top
    var ref_node_3 = num_node;
    for (var j = 1; j < n_f + 1; ++j) {
        for (var i = 0; i < 2 * n_r; ++i) {
            Node(num_node);
            nodes[num_node].coordinate_system_type = model.nodes.COORDINATE_SYSTEM_Z_CYLINDRICAL;
            nodes[num_node].coordinates = $V(r_t, i * PI / n_r, -r_b - j * H_1 / n_f);
            num_node++;
        };
    };

    // define a hinge
    var hinges_params_1 =
    {
        "moment_release_mt": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_n": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vy": model.member_hinges.SPRING_CONSTANT_NO,
        "axial_release_vz": model.member_hinges.SPRING_CONSTANT_NO
    }
    var member_hinge = MemberHinge(undefined, undefined, undefined, "", hinges_params_1);

    // Create members
    var horizontals = {
        "section_start": sections[1],
        "type": model.members.TYPE_BEAM,
        "member_hinge_start": member_hinge,
        "member_hinge_end": member_hinge
    };
    var verticals = {
        "section_start": sections[2],
        "type": model.members.TYPE_BEAM
    };
    var diagonals = {
        "section_start": sections[3],
        "type": model.members.TYPE_BEAM,
        "member_hinge_start": member_hinge,
        "member_hinge_end": member_hinge
    };

    var num_mem = 0;
    // Horizontals
    for (var j = 0; j < n_a + 1; ++j) {
        for (var i = 0; i < n_r - 1; ++i) {
            Member(num_mem, [ref_node_1 + i + j * n_r, ref_node_2 + i + j * n_r], "", horizontals);
            num_mem++;
            Member(num_mem, [ref_node_2 + i + j * n_r, ref_node_1 + i + 1 + j * n_r], "", horizontals);
            num_mem++;
        };
        Member(num_mem, [ref_node_1 + n_r - 1 + j * n_r, ref_node_2 + n_r - 1 + j * n_r], "", horizontals);
        num_mem++;
        Member(num_mem, [ref_node_2 + n_r - 1 + j * n_r, ref_node_1 + j * n_r], "", horizontals);
        num_mem++;
    };

    for (var j = 0; j < n_f; ++j) {
        for (var i = 0; i < 2 * n_r - 1; ++i) {
            Member(num_mem, [ref_node_3 + i + j * 2 * n_r, ref_node_3 + i + 1 + j * 2 * n_r], "", horizontals);
            num_mem++;
        };
        Member(num_mem, [ref_node_3 + 2 * n_r - 1 + j * 2 * n_r, ref_node_3 + j * 2 * n_r], "", horizontals);
        num_mem++;
    };

    // Diagonals
    for (var j = 0; j < n_a; ++j) {
        for (var i = 0; i < n_r - 1; ++i) {
            Member(num_mem, [ref_node_1 + i + j * n_r, ref_node_2 + n_r + i + j * n_r], "", diagonals);
            num_mem++;
            Member(num_mem, [ref_node_1 + i + 1 + j * n_r, ref_node_2 + n_r + i + j * n_r], "", diagonals);
            num_mem++;
        };
        Member(num_mem, [ref_node_1 + n_r - 1 + j * n_r, ref_node_2 + 2 * n_r - 1 + j * n_r], "", diagonals);
        num_mem++;
        Member(num_mem, [ref_node_1 + j * n_r, ref_node_2 + 2 * n_r - 1 + j * n_r], "", diagonals);
        num_mem++;
    };

    for (var i = 0; i < n_r - 1; ++i) {
        Member(num_mem, [ref_node_1 + n_r * n_a + i, ref_node_2 + n_r * (n_a + 1) + i], "", diagonals);
        num_mem++;
        Member(num_mem, [ref_node_1 + n_r * n_a + 1 + i, ref_node_2 + n_r * (n_a + 1) + i], "", diagonals);
        num_mem++;
        Member(num_mem, [ref_node_1 + n_r * n_a + i, ref_node_2 + n_r * (n_a + 2) + i], "", diagonals);
        num_mem++;
        Member(num_mem, [ref_node_1 + n_r * n_a + 1 + i, ref_node_2 + n_r * (n_a + 2) + i], "", diagonals);
        num_mem++;
    };
    Member(num_mem, [ref_node_1 + n_r * n_a + n_r - 1, ref_node_2 + n_r * (n_a + 1) + n_r - 1], "", diagonals);
    num_mem++;
    Member(num_mem, [ref_node_1 + n_r * n_a, ref_node_2 + n_r * (n_a + 1) + n_r - 1], "", diagonals);
    num_mem++;
    Member(num_mem, [ref_node_1 + n_r * n_a + n_r - 1, ref_node_2 + n_r * (n_a + 2) + n_r - 1], "", diagonals);
    num_mem++;
    Member(num_mem, [ref_node_1 + n_r * n_a, ref_node_2 + n_r * (n_a + 2) + n_r - 1], "", diagonals);
    num_mem++;

    for (var i = 0; i < n_r - 1; ++i) {
        Member(num_mem, [ref_node_1 + i, ref_node_3 + 1 + 2 * i], "", diagonals);
        num_mem++;
        Member(num_mem, [ref_node_1 + i + 1, ref_node_3 + 1 + 2 * i], "", diagonals);
        num_mem++;
    };
    Member(num_mem, [ref_node_1 + n_r - 1, ref_node_3 + 2 * n_r - 1], "", diagonals);
    num_mem++;
    Member(num_mem, [ref_node_1, ref_node_3 + 2 * n_r - 1], "", diagonals);
    num_mem++;

    for (var j = 0; j < n_f / 2; ++j) {
        for (var i = 0; i < n_r - 1; ++i) {
            Member(num_mem, [ref_node_3 + 2 * i + 1 + 4 * j * n_r, ref_node_3 + 2 * i + 2 * n_r + 4 * j * n_r], "", diagonals);
            num_mem++;
            Member(num_mem, [ref_node_3 + 2 * i + 1 + 4 * j * n_r, ref_node_3 + 2 + 2 * i + 2 * n_r + 4 * j * n_r], "", diagonals);
            num_mem++;
        };
        Member(num_mem, [ref_node_3 + 2 * n_r - 1 + 4 * j * n_r, ref_node_3 + 2 * n_r + 4 * j * n_r], "", diagonals);
        num_mem++;
        Member(num_mem, [ref_node_3 + 2 * n_r - 1 + 4 * j * n_r, ref_node_3 + 4 * n_r - 2 + 4 * j * n_r], "", diagonals);
        num_mem++;

        if (j == n_f / 2 - 1) {
            break;
        };

        for (var i = 0; i < n_r - 1; ++i) {
            Member(num_mem, [ref_node_3 + 2 * i + 2 * n_r + 4 * j * n_r, ref_node_3 + 2 * i + 4 * n_r + 1 + 4 * j * n_r], "", diagonals);
            num_mem++;
            Member(num_mem, [ref_node_3 + 2 * i + 2 * n_r + 2 + 4 * j * n_r, ref_node_3 + 2 * i + 4 * n_r + 1 + 4 * j * n_r], "", diagonals);
            num_mem++;
        };
        Member(num_mem, [ref_node_3 + 4 * n_r - 2 + 4 * j * n_r, ref_node_3 + 6 * n_r - 1 + 4 * j * n_r], "", diagonals);
        num_mem++;
        Member(num_mem, [ref_node_3 + 2 * n_r + 4 * j * n_r, ref_node_3 + 6 * n_r - 1 + 4 * j * n_r], "", diagonals);
        num_mem++;
    };

    // Verticals
    for (var j = 0; j < n_r; ++j) {
        for (var i = 0; i < n_a; ++i) {
            Member(num_mem, [ref_node_1 + i * n_r + j, ref_node_1 + i * n_r + n_r + j], "", verticals);
            num_mem++;
        };
    };

    for (var j = 0; j < n_r; ++j) {
        for (var i = 0; i < n_a + 2; ++i) {
            Member(num_mem, [ref_node_2 + i * n_r + j, ref_node_2 + i * n_r + n_r + j], "", verticals);
            num_mem++;
        };
    };

    for (var i = 0; i < n_r; ++i) {
        Member(num_mem, [ref_node_1 + i, ref_node_3 + 2 * i], "", verticals);
        num_mem++;
        Member(num_mem, [ref_node_2 + i, ref_node_3 + 2 * i + 1], "", verticals);
        num_mem++;
    };

    for (var j = 0; j < n_f - 1; ++j) {
        for (var i = 0; i < 2 * n_r; ++i) {
            Member(num_mem, [ref_node_3 + i + j * 2 * n_r, ref_node_3 + i + 2 * n_r + j * 2 * n_r], "", verticals);
            num_mem++;
        };
    };

    // assign supports to nodes 
    for (var i = 0; i < n_r; ++i) {
        nodes[ref_node_1 + n_r * n_a + i].support = nodal_supports[1];
    };

    // Deleting the auxiliary nodes
    for (var i = 0; i < 2 * n_a + 4; ++i) {
        nodes.erase(i);
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
        "linear_coordinate_system": coordinate_systems[1]
    };

    // x dimensions
    LinearDimension(undefined, [0, 0, -r_b - H_1], [r_t, 0, -r_b - H_1], "xz", "r<sub>t</sub>", -r_b - H_1 - 2, "", linear_dimension_params_1);

    // z dimensions
    LinearDimension(undefined, [r_b + r_t, 0, 0], [r_t, 0, -r_b], "zx", "r<sub>b</sub>", r_b + r_t + 2, "", linear_dimension_params_1);
    LinearDimension(undefined, [r_m, 0, r_m - r_b], [r_t, 0, -r_b], "zx", "r<sub>m</sub>", r_b + r_t, "", linear_dimension_params_1);
    LinearDimension(undefined, [r_t, 0, -r_b], [r_t, 0, -r_b - H_1], "zx", "H<sub>1</sub>", r_b + r_t + 2, "", linear_dimension_params_1);
}