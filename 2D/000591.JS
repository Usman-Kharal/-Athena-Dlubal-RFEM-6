function input_data() {
    category("Options");
    parameter_check("Ridge wedge included to model stiffness", "wedge_included", false);

    category("Geometry");
    parameter_float("Beam length", "L", "", 10, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Span", "l", "", 9.65, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    editable_condition(false);

    parameter_float("Width of supports", "l_a", "l<sub>a</sub>", 0.35, UNIT.SECTION_DIMENSION, 0, 0.01, NAN, false, false);
    parameter_float("Beam height", "h", "", 1, UNIT.SECTION_DIMENSION, 0, 0.01, NAN, false, false);
    parameter_float("Inclination angle", "delta", "&delta;", PI / 18, UNIT.ANGLE, 0, PI / 180, NAN, false, false);  // 10°
    parameter_float("Radius of curvature for lower chord", "R", "", 15, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Beam height on ridge (without ridge wedge)", "h_ap", "h<sub>ap</sub>", 1, UNIT.SECTION_DIMENSION, 0, 0.01, NAN, false, false);
    parameter_float("Cantilever length", "k", "", 1, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    parameter_float("Inclination of cantilever | End", "delta_s", "&delta;<sub>s</sub>", PI / 18, UNIT.ANGLE, NAN, PI / 180, NAN, false, false);  // 10°
    parameter_float("Inclination of cantilever | Bottom", "delta_k", "&delta;<sub>k</sub>", PI / 18, UNIT.ANGLE, NAN, PI / 180, NAN, false, false);  // 10°

    category("Material &amp; Thickness");
    thickness(1, "Beam width");

    category("Supports");
    nodal_support(1, "Nodal support | Left");
    nodal_support(2, "Nodal support | Right");
}

/*  Notes:
    L_min = 2*R*sin(delta)+2*l_a
    h_ap_min = h
    h_ap_max = R*sin(delta)*tan(delta) + R*cos(delta) - R + h/cos(delta)
*/

function generate() {
    // Dictionary for additionally calculated parameters
    var calculated_parameters = {};

    var l = L - l_a;
    calculated_parameters["l"] = l;

    //
    // Create structure
    //

    // auxiliary parameters
    var sin_d = sin(delta);
    var cos_d = cos(delta);
    var tan_d = tan(delta);

    var sin_k = sin(delta_k);
    var cos_k = cos(delta_k);

    var delta_s1 = atan(k / (h / cos_d - (l_a + k) * tan_d)) - delta_s;
    var delta_k1 = atan((h / cos_d - (l_a + k) * tan_d) / k) - delta_k;
    var gamma = Math.PI - delta_k1 - delta_s1;

    var c = sqrt(sqr(k) + sqr(h / cos_d - (l_a + k) * tan_d));
    var s1 = c * sin(delta_s1) / sin(gamma);
    var k1 = c * sin(delta_k1) / sin(gamma);

    var Z_B = -0.5 * (l - l_a) * tan_d - h / cos_d;                         // Z-coordinate of top arc TIP
    var X_C = 0.5 * l;                                                 // X-coordinate of arc center
    var Z_C = -0.5 * (l - l_a) * tan_d + R * sin_d * tan_d + R * cos_d;         // Z-coordinate of arc center

    if (h_ap == h) {
        var X_T = 0.5 * l - (R + h) * sin_d;                             // X-coordinate of line=tangent and arc touch point
        var Z_T = -0.5 * (l - l_a) * tan_d + R * sin_d * tan_d - h * cos_d;     // Z-coordinate of line=tangent and arc touch point
    }
    else {
        var X_T = (X_C + (0.5 * l_a * tan_d - h / cos_d - Z_C) * tan_d + sqrt(sqr(X_C + (0.5 * l_a * tan_d - h / cos_d - Z_C) * tan_d) - (sqr(tan_d) + 1) * (sqr(X_C) - sqr(R + h_ap) + sqr(0.5 * l_a * tan_d - h / cos_d - Z_C)))) / (sqr(tan_d) + 1);               // X-coordinate of line and arc intersection
        var Z_T = -X_T * tan_d + 0.5 * l_a * tan_d - h / cos_d;               // Z-coordinate of line and arc intersection
    }

    // create nodes (17)
    Node(0, 0.000, 0.000, 0.000);  // support 1 
    Node(1, l, 0.000, 0.000);  // support 2
    Node(2, -0.5 * l_a, 0.000, 0.000);
    Node(3, 0.5 * l_a, 0.000, 0.000);
    Node(4, 0.5 * l - R * sin_d, 0.000, -0.5 * (l - l_a) * tan_d + R * sin_d * tan_d);
    Node(5, 0.5 * l, 0.000, -0.5 * (l - l_a) * tan_d + R * sin_d * tan_d + R * cos_d - R);  // control point 1
    Node(6, 0.5 * l + R * sin_d, 0.000, -0.5 * (l - l_a) * tan_d + R * sin_d * tan_d);
    Node(7, -0.5 * l_a + l, 0.000, 0.000);
    Node(8, 0.5 * l_a + l, 0.000, 0.000);
    Node(9, -0.5 * l_a - k, 0.000, -h / cos_d + (l_a + k) * tan_d);
    Node(10, X_T, 0.000, Z_T);
    Node(11, 0.5 * l, 0.000, Z_B);
    Node(12, -X_T + l, 0.000, Z_T);
    Node(13, 0.5 * l_a + l + k, 0.000, -h / cos_d + (l_a + k) * tan_d);
    Node(14, -0.5 * l_a - s1 * cos_k, 0.000, -s1 * sin_k);
    Node(15, 0.5 * l_a + s1 * cos_k + l, 0.000, -s1 * sin_k);
    Node(16, 0.5 * l, 0.000, -0.5 * (l - l_a) * tan_d + R * sin_d * tan_d + R * cos_d - R - h_ap);  // control point 2

    // create lines (16)
    Line(0, [2, 0]);
    Line(1, [0, 3]);
    Line(2, [3, 4]);
    Line(3, [4, 6]).type = model.lines.TYPE_ARC;
    Line(4, [6, 7]);
    Line(5, [7, 1]);
    Line(6, [1, 8]);
    Line(7, [9, 10]);
    Line(8, [10, 11]);
    Line(9, [11, 12]);
    Line(10, [12, 13]);
    Line(11, [2, 14]);
    Line(12, [14, 9]);
    Line(13, [8, 15]);
    Line(14, [15, 13]);
    Line(15, [10, 12]).type = model.lines.TYPE_ARC;

    // assign arc geometry
    lines[3].arc_control_point = nodes[5].coordinates;
    lines[15].arc_control_point = nodes[16].coordinates;

    // create surfaces
    Surface(0, [0, 1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15]);
    Surface(1, [8, 9, 15]);

    // assign supports to nodes
    nodes[0].support = nodal_supports[1];
    nodes[1].support = nodal_supports[2];

    // assign thicknesses to surfaces
    surfaces[0].thickness = thicknesses[1];

    if (wedge_included == true) {
        surfaces[1].thickness = thicknesses[1];
    }
    else {
        surfaces[1].type = model.surfaces.TYPE_LOAD_TRANSFER;
    }


    //
    // Create coordinate systems
    //

    // coordinate system for all dimensions
    var coordinate_system_params_1 =
    {
        "origin_coordinates": [0.000, 0.000, 0.000],
        "u_axis_point_coordinates": [1, 0.000, 0.000],
        "uw_plane_point_coordinates": [0.000, 0.000, 1]
    }
    CoordinateSystem(1, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params_1);

    // coordinate system for dimension h
    var coordinate_system_params_2 =
    {
        "origin_coordinates": [0.5 * l + R * sin_d, 0.000, -0.5 * (l - l_a) * tan_d + R * sin_d * tan_d],
        "u_axis_point_coordinates": [l - 0.5 * l_a, 0.000, 0.000],
        "uw_plane_point_coordinates": [X_C, 0.000, Z_C]
    }
    var coordinate_system_2 = CoordinateSystem(2, model.coordinate_systems.TYPE_3_POINTS, undefined, coordinate_system_params_2);
    coordinate_system_2.user_defined_name_enabled = true;
    coordinate_system_2.name = "USS for h";


    //
    // Create dimensions (38)
    //

    var linear_dimension_params_1 = { "linear_coordinate_system": coordinate_systems[1] };
    var linear_dimension_params_2 = { "linear_coordinate_system": coordinate_systems[2] };

    // x dimensions
    // bottom
    LinearDimension(1, nodes[9], nodes[0], "xz", "", 1.5, "", linear_dimension_params_1);
    LinearDimension(2, nodes[0], nodes[1], "xz", "l", 1.5, "", linear_dimension_params_1);
    LinearDimension(3, nodes[1], nodes[13], "xz", "", 1.5, "", linear_dimension_params_1);

    LinearDimension(4, nodes[9], nodes[14], "xz", "", 2, "", linear_dimension_params_1);
    LinearDimension(5, nodes[14], nodes[2], "xz", "", 2, "", linear_dimension_params_1);
    LinearDimension(6, nodes[2], nodes[3], "xz", "l<sub>a</sub>", 2, "", linear_dimension_params_1);
    LinearDimension(7, nodes[3], nodes[7], "xz", "", 2, "", linear_dimension_params_1);
    LinearDimension(8, nodes[7], nodes[8], "xz", "l<sub>a</sub>", 2, "", linear_dimension_params_1);
    LinearDimension(9, nodes[8], nodes[15], "xz", "", 2, "", linear_dimension_params_1);
    LinearDimension(10, nodes[15], nodes[13], "xz", "", 2, "", linear_dimension_params_1);

    LinearDimension(11, nodes[9], nodes[2], "xz", "k", 2.5, "", linear_dimension_params_1);
    LinearDimension(12, nodes[2], nodes[8], "xz", "L", 2.5, "", linear_dimension_params_1);
    LinearDimension(13, nodes[8], nodes[13], "xz", "k", 2.5, "", linear_dimension_params_1);

    LinearDimension(14, nodes[9], nodes[13], "xz", "", 3, "", linear_dimension_params_1);

    LinearDimension(15, nodes[3], nodes[4], "", "", -1).linear_plane = model.dimensions.PLANE_SECOND;
    LinearDimension(16, nodes[6], nodes[7], "", "", -1).linear_plane = model.dimensions.PLANE_SECOND;

    // top
    LinearDimension(17, nodes[9], nodes[10], "", "", 1).linear_plane = model.dimensions.PLANE_SECOND;
    LinearDimension(18, nodes[10], nodes[11], "", "", 1).linear_plane = model.dimensions.PLANE_SECOND;
    LinearDimension(19, nodes[11], nodes[12], "", "", 1).linear_plane = model.dimensions.PLANE_SECOND;
    LinearDimension(20, nodes[12], nodes[13], "", "", 1).linear_plane = model.dimensions.PLANE_SECOND;

    LinearDimension(21, nodes[9], nodes[11], "", "", 1.5).linear_plane = model.dimensions.PLANE_SECOND;
    LinearDimension(22, nodes[11], nodes[13], "", "", 1.5).linear_plane = model.dimensions.PLANE_SECOND;

    // z dimensions
    // right side
    var offset_2 = l + 0.5 * l_a + k;

    LinearDimension(23, nodes[8], nodes[15], "zx", "", offset_2 + 1, "", linear_dimension_params_1);
    LinearDimension(24, nodes[15], nodes[13], "zx", "", offset_2 + 1, "", linear_dimension_params_1);
    LinearDimension(25, nodes[13], nodes[16], "zx", "", offset_2 + 1, "", linear_dimension_params_1);

    LinearDimension(26, nodes[8], nodes[16], "zx", "", offset_2 + 1.5, "", linear_dimension_params_1);
    LinearDimension(27, nodes[16], nodes[11], "zx", "", offset_2 + 1.5, "", linear_dimension_params_1);

    LinearDimension(28, nodes[8], nodes[11], "zx", "", offset_2 + 2, "", linear_dimension_params_1);

    // center
    LinearDimension(29, nodes[3], nodes[5], "zx", "", 0.5 * l, "", linear_dimension_params_1);
    LinearDimension(30, nodes[5], nodes[16], "zx", "h<sub>ap</sub>", 0.5 * l, "", linear_dimension_params_1);

    LinearDimension(31, nodes[7], nodes[13], "zx", "h", -1, "", linear_dimension_params_2);  // dimension W of rotated UCS 2
    dimensions[31].is_global_dimension_line_offset = false;

    // arc length dimensions
    // bottom
    ArcLengthDimension(32, lines[3], "", -1);

    // top
    ArcLengthDimension(33, lines[15], "", 2.2);

    // radius dimensions
    RadiusDimension(34, lines[3], "R", 1.5, 0.8);
    RadiusDimension(35, lines[15], "", h_ap + 1.5, 0.7);

    // slope dimensions
    SlopeDimension(36, lines[7], "&delta;", X_T - 2, 0, "downward", "xy");
    dimensions[36].is_global_dimension_line_offset = true;
    dimensions[36].slope_refer_distance_from_line_end = true;

    SlopeDimension(37, lines[12], "&delta;<sub>s</sub>", 2, 0, "upward", "yz");
    dimensions[37].slope_refer_distance_from_line_end = true;

    SlopeDimension(38, lines[11], "&delta;<sub>k</sub>", -0.5 * l_a - k - 1, 0, "upward", "xy");
    dimensions[38].is_global_dimension_line_offset = true;


    // return dictionary with calculated variables
    return calculated_parameters;
}