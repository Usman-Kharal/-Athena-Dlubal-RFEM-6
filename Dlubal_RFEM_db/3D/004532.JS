function input_data() {
  category("Basic Data");
  parameter_int("Number of bays", "n", "", 14, UNIT.NONE, 4, 2, 100, true, true);


  category("Geometry");
  parameter_float("Total length", "L", "", 40, UNIT.LENGTH, 0, 0.1, NAN, false, false);

  parameter_float("Height 1", "H_1", "H<sub>1</sub>", 1.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);  //1.5
  parameter_float("Height 2", "H_2", "H<sub>2</sub>", 7, UNIT.LENGTH, 0, 0.1, NAN, false, false);
  parameter_float("Height 3", "H_3", "H<sub>3</sub>", 3.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);
  parameter_float("Height 4", "H_4", "H<sub>4</sub>", 2.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);

  parameter_float("Width", "W", "", 2.8, UNIT.LENGTH, 0, 0.1, NAN, false, false);
  parameter_float("Width 1", "W_1", "W<sub>1</sub>", 3.5, UNIT.LENGTH, 0, 0.1, NAN, false, false);

  parameter_float("Distance 1", "d_1", "d<sub>1</sub>", 10, UNIT.LENGTH, 0, 0.1, NAN, false, false);
  parameter_float("Distance 2", "d_2", "d<sub>2</sub>", 12, UNIT.LENGTH, 0, 0.1, NAN, false, false);

  category("Materials &amp; Sections");
  section(1, "Top chord");
  section(2, "Bottom chord");
  section(3, "Diagonals");
  section(4, "Verticals");
  section(5, "Posts");
  section(6, "Bracing of posts");
  section(7, "Deck | Horizontals");
  section(8, "Section 8");
  section(9, "Cables 1");
  section(10, "Cables 2");

  category("Materials & Thicknesses");
  thickness(1, "Thickness");

  category("Supports");
  nodal_support(1, "Nodal support 1");
  nodal_support(2, "Nodal support 2");

  var LOADING = loading_category("Loads");
  var TENSION = category("Form-finding prestress", false, LOADING);
  load_case(1, "Load case");
  category("Cables", false, TENSION)
  parameter_float("Average force in cables 1", "T_avg_1", "T<sub>avg1</sub>", 800000, UNIT.LOADS_FORCE, 0.0, 1000, NAN, true, true);
  parameter_float("Average force in cables 2", "T_avg_2", "T<sub>avg2</sub>", 35000, UNIT.LOADS_FORCE, 0.0, 1000, NAN, true, true);
  parameter_float("Average force in cables to support", "T_avg_3", "T<sub>avg3</sub>", 1100000, UNIT.LOADS_FORCE, 0.0, 1000, NAN, true, true);
}

function generate() {
  ASSERT(n % 2 == 0, "n should be even");
  FORM_FINDING.setActive(true);

  var l_1 = L / (2 * n);
  var d_s = sections[2].h;
  //
  // Create structure
  //

  // Create nodes
  var num_node = 0;
  for (var j = 0; j < 2; ++j) {
    if (j == 1) { var node_ref = num_node };
    // Node of bottom chord
    for (var i = 0; i < 2 * n + 3; ++i) {
      Node(num_node, -L / 2 - l_1 + i * l_1, -W / 2 + j * W, 0);
      num_node++;
    };
    // Node of top chord
    for (var i = 0; i < 2 * n + 1; ++i) {
      Node(num_node, -L / 2 + i * l_1, -W / 2 + j * W, -H_1);
      num_node++;
    };
  };

  var ref_brc_1 = num_node;
  for (var j = 0; j < 2; ++j) {
    if (j == 1) { var ref_brc_2 = num_node; }
    // Node of top chord
    for (var i = 0; i < 2 * n + 1; ++i) {
      Node(num_node, -L / 2 + i * l_1, -W_1 / 2 + j * W_1, 0);
      num_node++;
    };
  };

  var ref_post = num_node;
  for (var j = 0; j < 2; ++j) {
    Node(num_node, -L / 2 + j * L, -W_1 / 2, d_s);
    num_node++;
    Node(num_node, -L / 2 + j * L, -W_1 / 2, -H_3);
    num_node++;
    Node(num_node, -L / 2 + j * L, -W_1 / 2, -H_3 - H_4);
    num_node++;
    Node(num_node, -L / 2 + j * L, -W_1 / 2, -H_2);
    num_node++;
    Node(num_node, -L / 2 + j * L, W_1 / 2, d_s);
    num_node++;
    Node(num_node, -L / 2 + j * L, W_1 / 2, -H_3);
    num_node++;
    Node(num_node, -L / 2 + j * L, W_1 / 2, -H_3 - H_4);
    num_node++;
    Node(num_node, -L / 2 + j * L, W_1 / 2, -H_2);
    num_node++;
  };

  var ref_cables_1 = num_node;
  for (var i = 1; i < n; ++i) {
    Node(num_node, -L / 2 + 2 * i * l_1, -W_1 / 2, -H_2);
    num_node++;
    Node(num_node, -L / 2 + 2 * i * l_1, W_1 / 2, -H_2);
    num_node++;
  };

  var ref_cables_2 = num_node;
  Node(num_node, -L / 2 - d_1, -d_2 / 2, 0);
  num_node++;
  Node(num_node, -L / 2 - d_1, d_2 / 2, 0);
  num_node++;
  Node(num_node, L / 2 + d_1, -d_2 / 2, 0);
  num_node++;
  Node(num_node, L / 2 + d_1, d_2 / 2, 0);
  num_node++;

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
  var posts = {
    "section_start": sections[5],
    "type": model.members.TYPE_BEAM
  };
  var post_brc = {
    "section_start": sections[6],
    "type": model.members.TYPE_BEAM
  };
  var deck = {
    "section_start": sections[7],
    "type": model.members.TYPE_BEAM
  };
  var section_8 = {
    "section_start": sections[8],
    "type": model.members.TYPE_BEAM
  };
  var cables_1 = {
    "section_start": sections[9],
    "type": model.members.TYPE_CABLE
  };
  var cables_2 = {
    "section_start": sections[10],
    "type": model.members.TYPE_CABLE
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

  var mem_num = 0
  for (var j = 0; j < 2; ++j) {
    // Bottom chord
    for (var i = 0; i < 2 * n + 2; ++i) {
      Member(mem_num, [i + j * node_ref, i + 1 + j * node_ref], "", bottom_chord);
      members[mem_num].rotation_angle = PI;
      mem_num++;
    };
    // Top chord
    for (var i = 0; i < 2 * n; ++i) {
      Member(mem_num, [i + j * node_ref + 2 * n + 3, i + 1 + j * node_ref + 2 * n + 3], "", top_chord);
      mem_num++;
    };
    // Verticals
    for (var i = 0; i < 2 * n + 1; ++i) {
      Member(mem_num, [i + j * node_ref + 1, i + 1 + j * node_ref + 2 * n + 2], "", verticals);
      members[mem_num].member_hinge_start = member_hinge;
      members[mem_num].member_hinge_end = member_hinge;
      mem_num++;
    };

    // Diagonals
    for (var i = 0; i < n + 1; ++i) {
      Member(mem_num, [2 * i + j * node_ref, 2 * i + 1 + j * node_ref + 2 * n + 2], "", diagonals);
      members[mem_num].member_hinge_start = member_hinge;
      members[mem_num].member_hinge_end = member_hinge;
      mem_num++;

      Member(mem_num, [2 * i + j * node_ref + 2, 2 * i + 1 + j * node_ref + 2 * n + 2], "", diagonals);
      members[mem_num].member_hinge_start = member_hinge;
      members[mem_num].member_hinge_end = member_hinge;
      mem_num++;
    };
  };

  // Deck beams  
  MemberEccentricity(1);
  member_eccentricities[1].specification_type = model.member_eccentricities.TYPE_RELATIVE;
  member_eccentricities[1].vertical_section_alignment = model.member_eccentricities.ALIGN_TOP;
  member_eccentricities[1].horizontal_section_alignment = model.member_eccentricities.ALIGN_MIDDLE;
  member_eccentricities[1].transverse_offset_active = true;
  member_eccentricities[1].transverse_offset_reference_type = model.member_eccentricities.TRANSVERSE_OFFSET_TYPE_FROM_MEMBER_SECTION;
  member_eccentricities[1].transverse_offset_reference_member = members[0];
  member_eccentricities[1].transverse_offset_vertical_alignment = model.member_eccentricities.ALIGN_TOP;
  member_eccentricities[1].transverse_offset_horizontal_alignment = model.member_eccentricities.ALIGN_MIDDLE;

  var mem_ref = mem_num;

  Member(mem_num, [0, node_ref], "", deck);
  members[mem_num].member_eccentricity_start = member_eccentricities[1];
  members[mem_num].member_eccentricity_end = member_eccentricities[1];
  mem_num++;
  Member(mem_num, [2 * n + 2, node_ref + 2 * n + 2], "", deck);
  members[mem_num].member_eccentricity_start = member_eccentricities[1];
  members[mem_num].member_eccentricity_end = member_eccentricities[1];
  mem_num++;

  for (var i = 0; i < 2 * n + 1; ++i) {
    Member(mem_num, [ref_brc_1 + i, i + 1], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
    Member(mem_num, [i + 1, node_ref + i + 1], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
    Member(mem_num, [node_ref + i + 1, ref_brc_2 + i], "", deck);
    members[mem_num].member_eccentricity_start = member_eccentricities[1];
    members[mem_num].member_eccentricity_end = member_eccentricities[1];
    mem_num++;
  };

  // Deck bracing
  for (var i = 0; i < n; ++i) {
    Member(mem_num, [ref_brc_1 + 1 + 2 * i, 2 * n + 3 + 2 * i + 1], "", section_8);
    mem_num++;
    Member(mem_num, [ref_brc_2 + 1 + 2 * i, node_ref + 2 * n + 3 + 2 * i + 1], "", section_8);
    mem_num++;
  };

  // Create posts
  for (var j = 0; j < 4; ++j) {
    for (var i = 0; i < 3; ++i) {
      Member(mem_num, [ref_post + i + 4 * j, ref_post + i + 1 + 4 * j], "", posts);
      mem_num++;
    };
  };

  for (var j = 0; j < 2; ++j) {
    Member(mem_num, [ref_post + 1 + 8 * j, ref_post + 6 + 8 * j], "", post_brc);
    mem_num++;
    Member(mem_num, [ref_post + 5 + 8 * j, ref_post + 2 + 8 * j], "", post_brc);
    mem_num++;
    Member(mem_num, [ref_post + 1 + 8 * j, ref_post + 5 + 8 * j], "", post_brc);
    mem_num++;
    Member(mem_num, [ref_post + 2 + 8 * j, ref_post + 6 + 8 * j], "", post_brc);
    mem_num++;
  };

  // Create cables
  var cables_1_list = [];
  var cables_2_list = [];
  var cables_to_sup = [];

  Member(mem_num, [ref_post + 3, ref_cables_1], "", cables_1);
  cables_1_list.push(members[mem_num]);
  mem_num++;
  Member(mem_num, [ref_post + 7, ref_cables_1 + 1], "", cables_1);
  cables_1_list.push(members[mem_num]);
  mem_num++;
  for (var i = 0; i < n - 2; ++i) {
    Member(mem_num, [ref_cables_1 + 2 * i, ref_cables_1 + 2 * i + 2], "", cables_1);
    cables_1_list.push(members[mem_num]);
    mem_num++;
    Member(mem_num, [ref_cables_1 + 2 * i + 1, ref_cables_1 + 2 * i + 3], "", cables_1);
    cables_1_list.push(members[mem_num]);
    mem_num++;
  };
  Member(mem_num, [ref_cables_1 + 2 * n - 4, ref_post + 11], "", cables_1);
  cables_1_list.push(members[mem_num]);
  mem_num++;
  Member(mem_num, [ref_cables_1 + 2 * n - 3, ref_post + 15], "", cables_1);
  cables_1_list.push(members[mem_num]);
  mem_num++;

  Member(mem_num, [ref_cables_2, ref_post + 3], "", cables_1);
  cables_to_sup.push(members[mem_num]);
  mem_num++;
  Member(mem_num, [ref_cables_2 + 1, ref_post + 7], "", cables_1);
  cables_to_sup.push(members[mem_num]);
  mem_num++;
  Member(mem_num, [ref_cables_2 + 2, ref_post + 11], "", cables_1);
  cables_to_sup.push(members[mem_num]);
  mem_num++;
  Member(mem_num, [ref_cables_2 + 3, ref_post + 15], "", cables_1);
  cables_to_sup.push(members[mem_num]);
  mem_num++;

  for (var i = 0; i < n - 1; ++i) {
    Member(mem_num, [ref_brc_1 + 2 * i + 2, ref_cables_1 + 2 * i], "", cables_2);
    cables_2_list.push(members[mem_num]);
    mem_num++;
    Member(mem_num, [ref_brc_2 + 2 * i + 2, ref_cables_1 + 2 * i + 1], "", cables_2);
    cables_2_list.push(members[mem_num]);
    mem_num++;
  };

  // Create deck surface
  for (var i = 0; i < 2 * n + 1; ++i) {
    Surface(i, [lines[i], lines[8 * n + 5 + i], lines[mem_ref + 3 * i], lines[mem_ref + 3 * i + 3]]).type = model.surfaces.TYPE_STANDARD;
    surfaces[i].geometry = model.surfaces.GEOMETRY_PLANE;
    surfaces[i].thickness = thicknesses[1];
  };
  Surface(2 * n + 1, [lines[2 * n + 1], lines[8 * n + 5 + 2 * n + 1], lines[mem_ref + 1], lines[mem_ref + 3 * (2 * n) + 3]]).type = model.surfaces.TYPE_STANDARD;
  surfaces[2 * n + 1].geometry = model.surfaces.GEOMETRY_PLANE;
  surfaces[2 * n + 1].thickness = thicknesses[1];

  // Assign supports
  nodes[ref_post].support = nodal_supports[1];
  nodes[ref_post + 4].support = nodal_supports[1];
  nodes[ref_post + 8].support = nodal_supports[1];
  nodes[ref_post + 12].support = nodal_supports[1];
  nodes[ref_cables_2].support = nodal_supports[2];
  nodes[ref_cables_2 + 1].support = nodal_supports[2];
  nodes[ref_cables_2 + 2].support = nodal_supports[2];
  nodes[ref_cables_2 + 3].support = nodal_supports[2];

  // Loads
  var FF_load_case = load_cases[1];
  if (FF_load_case) {
    var tension_horizontal_member_load = MemberLoad(1, FF_load_case);
    tension_horizontal_member_load.load_type = model.member_loads.LOAD_TYPE_FORM_FINDING;
    tension_horizontal_member_load.form_finding_definition_type = model.member_loads.FORM_FINDING_TYPE_FORCE;
    tension_horizontal_member_load.form_finding_force_definition = model.member_loads.FORM_FINDING_FORCE_INPUT_PARAMETER_AVERAGE;
    tension_horizontal_member_load.magnitude = T_avg_1;

    tension_horizontal_member_load.members = cables_1_list;

    var tension_horizontal_member_load_2 = MemberLoad(2, FF_load_case);
    tension_horizontal_member_load_2.load_type = model.member_loads.LOAD_TYPE_FORM_FINDING;
    tension_horizontal_member_load_2.form_finding_definition_type = model.member_loads.FORM_FINDING_TYPE_FORCE;
    tension_horizontal_member_load_2.form_finding_force_definition = model.member_loads.FORM_FINDING_FORCE_INPUT_PARAMETER_AVERAGE;
    tension_horizontal_member_load_2.magnitude = T_avg_2;

    tension_horizontal_member_load_2.members = cables_2_list;

    var tension_horizontal_member_load_3 = MemberLoad(3, FF_load_case);
    tension_horizontal_member_load_3.load_type = model.member_loads.LOAD_TYPE_FORM_FINDING;
    tension_horizontal_member_load_3.form_finding_definition_type = model.member_loads.FORM_FINDING_TYPE_FORCE;
    tension_horizontal_member_load_3.form_finding_force_definition = model.member_loads.FORM_FINDING_FORCE_INPUT_PARAMETER_AVERAGE;
    tension_horizontal_member_load_3.magnitude = T_avg_3;

    tension_horizontal_member_load_3.members = cables_to_sup;
  };

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
  LinearDimension(0, nodes[node_ref + 1], nodes[node_ref + 2 * n + 1], "xy", "L", W / 2 + 2, "", linear_dimension_params_1);
  LinearDimension(1, nodes[node_ref + 2 * n + 2], nodes[ref_cables_2 + 3], "xy", "d<sub>1</sub>", d_2 / 2 + 2, "", linear_dimension_params_1);
  LinearDimension(2, nodes[node_ref], nodes[ref_cables_2 + 1], "xy", "d<sub>1</sub>", d_2 / 2 + 2, "", linear_dimension_params_1);

  // y dimensions
  LinearDimension(3, nodes[ref_cables_2], nodes[ref_cables_2 + 1], "yx", "d<sub>2</sub>", -L / 2 - d_1 - 2, "", linear_dimension_params_1);
  LinearDimension(4, nodes[ref_cables_2 + 2], nodes[ref_cables_2 + 3], "yx", "d<sub>2</sub>", L / 2 + d_1 + 2, "", linear_dimension_params_1);
  LinearDimension(5, nodes[2 * n + 2], nodes[node_ref + 2 * n + 2], "yx", "W", L / 2 + L / n + 2, "", linear_dimension_params_1);
  LinearDimension(6, nodes[ref_brc_1 + 2 * n], nodes[ref_brc_2 + 2 * n], "yx", "W<sub>1</sub>", L / 2 + L / n + 4, "", linear_dimension_params_1);

  // z dimension
  LinearDimension(7, nodes[2 * n + 1], nodes[ref_post + 9], "zy", "H<sub>3</sub>", -W_1 / 2 - 2, "", linear_dimension_params_1);
  LinearDimension(8, nodes[ref_post + 9], nodes[ref_post + 10], "zy", "H<sub>4</sub>", -W_1 / 2 - 2, "", linear_dimension_params_1);
  LinearDimension(9, nodes[ref_post + 10], nodes[ref_post + 11], "zy", "", -W_1 / 2 - 2, "", linear_dimension_params_1);
  LinearDimension(10, nodes[2 * n + 1], nodes[ref_post + 11], "zy", "H<sub>2</sub>", -W_1 / 2 - 4, "", linear_dimension_params_1);
  LinearDimension(11, nodes[node_ref + 2 * n + 1], nodes[node_ref + 4 * n + 3], "zy", "H<sub>1</sub>", W / 2 + 2, "", linear_dimension_params_1);
}