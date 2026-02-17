function input_data() {
    var BASIC_DATA = category("Basic Data");

    combobox("Roof shape", "roof_shape");
    combobox_value("Duopitch", "double_pitch", true);
    combobox_value("Monopitch", "single_pitch");
    combobox_value("Flat", "flat");

    parameter_check("Cantilever", "cantilever", true);

    category("Column", false, BASIC_DATA);

    parameter_check("Tapered column", "column_taper_check", true);

    parameter_check("Full length", "full_length_column_check", false);
    condition("column_taper_check == true");

    combobox("Tapered column", "column_taper");
    condition("column_taper_check == true");
    combobox_value("Inwards", "column_inwards", true);
    combobox_value("Centric", "column_centric");
    combobox_value("Outwards", "column_outwards");

    category("Rafter", false, BASIC_DATA);
    parameter_check("Tapered rafter", "rafter_taper_check", true);

    parameter_check("Tapered rafter | Both sides", "rafter_taper_both_side_check", true);
    condition("roof_shape == double_pitch && rafter_taper_check == true");

    parameter_check("Full length", "full_length_rafter_check", false);
    condition("rafter_taper_check == true")

    combobox("Tapered rafter", "rafter_taper");
    condition("rafter_taper_check == true");
    combobox_value("Inwards", "rafter_inwards", true);
    combobox_value("Centric", "rafter_centric");
    combobox_value("Outwards", "rafter_outwards");


    var GEOMETRY = category("Geometry");
    parameter_float("Total length", "L", "", 15, UNIT.LENGTH, 0.0, 0.1, 50, false, true);

    parameter_float("Roof Height", "H_c", "H<sub>c</sub>", 2, UNIT.LENGTH, 0.0, 0.1, 50, false, true);
    condition("roof_shape == double_pitch");

    parameter_float("Column height", "H", "", 5.5, UNIT.LENGTH, 0.0, 0.1, 50, false, true);
    condition("roof_shape == double_pitch || roof_shape == flat");

    parameter_float("Column height | Left", "H_l", "H<sub>L</sub>", 3.5, UNIT.LENGTH, 0.0, 0.1, 50, false, true);
    condition("roof_shape == single_pitch");

    parameter_float("Column height | Right", "H_r", "H<sub>R</sub>", 5.5, UNIT.LENGTH, 0.0, 0.1, 50, false, true);
    condition("roof_shape == single_pitch");


    parameter_float("Tapered length | Column", "l_c", "l<sub>c</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    condition("(column_taper_check == true && (roof_shape == double_pitch || roof_shape == flat)) && full_length_column_check == false");

    parameter_float("Tapered length | Left column", "l_c_l", "l<sub>c,L</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    condition("(column_taper_check == true && roof_shape == single_pitch) && full_length_column_check == false");
    parameter_float("Tapered length | Right column", "l_c_r", "l<sub>c,R</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    condition("(column_taper_check == true && roof_shape == single_pitch) && full_length_column_check == false");

    parameter_float("Tapered length | Rafter", "l_r", "l<sub>r</sub>", 4, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    condition("rafter_taper_check == true && full_length_rafter_check == false");

    parameter_float("Tapered length | Tip", "l_t", "l<sub>t</sub>", 3, UNIT.LENGTH, 0, 0.1, NAN, false, false);
    condition("roof_shape == double_pitch && rafter_taper_both_side_check == true");

    parameter_float("Cantilever | Right", "c_r", "c<sub>R</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, true, false);
    condition("cantilever == true");
    parameter_float("Cantilever | Left", "c_l", "c<sub>L</sub>", 2, UNIT.LENGTH, 0, 0.1, NAN, true, false);
    condition("cantilever == true");

    category("Materials &amp; Sections");
    section(1, "Column");
    section(2, "Column | Frame corner");
    condition("column_taper_check == true");
    section(3, "Rafter");
    section(4, "Rafter | Frame corner");
    condition("rafter_taper_check == true");
    section(5, "Cantilever");
    condition("cantilever == true");

    category("Supports");
    nodal_support(1, "Nodal support | Left");
    nodal_support(2, "Nodal support | Right");

    var LOADING_CATEGORY = loading_category("Loads");
    parameter_check("Live load", "live_load_checkbox", true);
    parameter_check("Snow load", "snow_load_checkbox", true);

    var LIVE_LOAD = category("Live load", false, LOADING_CATEGORY);
    condition("live_load_checkbox == true");
    load_case(1, "Load case");
    category("Nodal load", false, LIVE_LOAD);
    parameter_float("Force in X-direction", "force_x", "P<sub>x</sub>", 0, UNIT.LOADS_FORCE, NAN, 100, NAN, true, false);
    parameter_float("Force in Z-direction", "force_z", "P<sub>z</sub>", 1000, UNIT.LOADS_FORCE, NAN, 100, NAN, true, false);
    category("Member load", false, LIVE_LOAD);
    parameter_float("Load magnitude", "magnitude_w", "w", 1000, UNIT.LOADS_FORCE_PER_UNIT_LENGTH, 0, 100, NAN, true, false);

    category("Snow load", false, LOADING_CATEGORY);
    condition("snow_load_checkbox == true");
    load_case(2, "Load case");
    parameter_float("Magnitude", "magnitude_s", "p", 1000, UNIT.LOADS_SURFACE_TYPE_LOAD, NAN, 100, NAN, true, false);
}

function generate() {

    var alpha = atan(H_c / (L / 2));
    var beta = atan((H_r - H_l) / L);

    // Create nodes
    var num_node = 0;
    if (roof_shape == "double_pitch") {
        if (column_taper_check == true && full_length_column_check == true) {
            l_c = H;
        };

        Node(num_node, 0, 0, 0);
        num_node++;
        Node(num_node, 0, 0, -H);
        num_node++;
        Node(num_node, L, 0, 0);
        num_node++;
        Node(num_node, L, 0, -H);
        num_node++;
        Node(num_node, L / 2, 0, -H - H_c);
        num_node++;

        var ref_column_taper = num_node;
        if (column_taper_check == true) {
            Node(num_node, 0, 0, -H + l_c);
            num_node++;
            Node(num_node, L, 0, -H + l_c);
            num_node++;
        };

        var ref_rafter_taper = num_node;
        if (rafter_taper_check == true && full_length_rafter_check == false) {
            Node(num_node, l_r * cos(alpha), 0, -H - l_r * sin(alpha));
            num_node++;
            Node(num_node, L - l_r * cos(alpha), 0, -H - l_r * sin(alpha));
            num_node++;
        };

        var ref_tip_rafter_taper = num_node;
        if (rafter_taper_check == true && rafter_taper_both_side_check == true) {
            Node(num_node, L / 2 - l_t * cos(alpha), 0, -H - H_c + l_t * sin(alpha));
            num_node++;
            Node(num_node, L / 2 + l_t * cos(alpha), 0, -H - H_c + l_t * sin(alpha));
            num_node++;
        };

        var ref_cantilever = num_node;
        if (cantilever == true) {
            Node(num_node, -c_l * cos(alpha), 0, -H + c_l * sin(alpha));
            num_node++;
            Node(num_node, L + c_r * cos(alpha), 0, -H + c_r * sin(alpha));
            num_node++;
        };
    }
    else if (roof_shape == "single_pitch") {
        if (column_taper_check == true && full_length_column_check == true) {
            l_c_l = H_l;
            l_c_r = H_r;
        };

        Node(num_node, 0, 0, 0);
        num_node++;
        Node(num_node, 0, 0, -H_l);
        num_node++;
        Node(num_node, L, 0, 0);
        num_node++;
        Node(num_node, L, 0, -H_r);
        num_node++;

        var ref_column_taper = num_node;
        if (column_taper_check == true) {
            Node(num_node, 0, 0, -H_l + l_c_l);
            num_node++;
            Node(num_node, L, 0, -H_r + l_c_r);
            num_node++;
        };

        var ref_rafter_taper = num_node;
        if (rafter_taper_check == true && full_length_rafter_check == false) {
            Node(num_node, l_r * cos(beta), 0, -H_l - l_r * sin(beta));
            num_node++;
            Node(num_node, L - l_r * cos(beta), 0, -H_r + l_r * sin(beta));
            num_node++;
        };

        var ref_cantilever = num_node;
        if (cantilever == true) {
            Node(num_node, -c_l * cos(beta), 0, -H_l + c_l * sin(beta));
            num_node++;
            Node(num_node, L + c_r * cos(beta), 0, -H_r - c_r * sin(beta));
            num_node++;
        };
    }
    else {
        if (column_taper_check == true && full_length_column_check == true) {
            l_c = H;
        };

        Node(num_node, 0, 0, 0);
        num_node++;
        Node(num_node, 0, 0, -H);
        num_node++;
        Node(num_node, L, 0, 0);
        num_node++;
        Node(num_node, L, 0, -H);
        num_node++;

        var ref_column_taper = num_node;
        if (column_taper_check == true) {
            Node(num_node, 0, 0, -H + l_c);
            num_node++;
            Node(num_node, L, 0, -H + l_c);
            num_node++;
        };

        var ref_rafter_taper = num_node;
        if (rafter_taper_check == true && full_length_rafter_check == false) {
            Node(num_node, l_r, 0, -H);
            num_node++;
            Node(num_node, L - l_r, 0, -H);
            num_node++;
        };

        var ref_cantilever = num_node;
        if (cantilever == true) {
            Node(num_node, -c_l, 0, -H);
            num_node++;
            Node(num_node, L + c_r, 0, -H);
            num_node++;
        };
    };

    // Create members
    var column_params_1 = { "section_start": sections[1] };

    if (column_taper_check == true) {
        var column_params_2 =
        {
            "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
            "section_alignment": model.members.SECTION_ALIGNMENT_TOP,
            "section_start": sections[1],
            "section_end": sections[2]
        };

        var column_params_3 =
        {
            "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
            "section_alignment": model.members.SECTION_ALIGNMENT_CENTRIC,
            "section_start": sections[1],
            "section_end": sections[2]
        };

        var column_params_4 =
        {
            "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
            "section_alignment": model.members.SECTION_ALIGNMENT_BOTTOM,
            "section_start": sections[1],
            "section_end": sections[2]
        };
    };

    var rafter_params_1 = { "section_start": sections[3] };

    if (rafter_taper_check == true) {
        var rafter_params_2 =
        {
            "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
            "section_alignment": model.members.SECTION_ALIGNMENT_TOP,
            "section_start": sections[4],
            "section_end": sections[3]
        };

        var rafter_params_3 =
        {
            "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
            "section_alignment": model.members.SECTION_ALIGNMENT_CENTRIC,
            "section_start": sections[4],
            "section_end": sections[3]
        };

        var rafter_params_4 =
        {
            "section_distribution_type": model.members.SECTION_DISTRIBUTION_TYPE_LINEAR,
            "section_alignment": model.members.SECTION_ALIGNMENT_BOTTOM,
            "section_start": sections[4],
            "section_end": sections[3]
        };
    };

    if (cantilever == true) {
        var cantilever_s = {
            "section_start": sections[5],
            "type": model.members.TYPE_BEAM
        };
    };

    var mem_num = 0;

    // Create members
    // Columns
    if (roof_shape == "double_pitch" || roof_shape == "flat") {
        if (column_taper == "column_inwards") {
            if (column_taper_check == true) {
                if (l_c != H) {
                    Member(mem_num, [0, ref_column_taper], "", column_params_1);
                    mem_num++;
                    Member(mem_num, [2, ref_column_taper + 1], "", column_params_1);
                    mem_num++;
                };
                Member(mem_num, [ref_column_taper, 1], "", column_params_2);
                mem_num++;
                Member(mem_num, [ref_column_taper + 1, 3], "", column_params_4);
                mem_num++;
            }
            else {
                Member(mem_num, [0, 1], "", column_params_1);
                mem_num++;
                Member(mem_num, [2, 3], "", column_params_1);
                mem_num++;
            };
        }
        else if (column_taper == "column_outwards") {
            if (column_taper_check == true) {
                if (l_c != H) {
                    Member(mem_num, [0, ref_column_taper], "", column_params_1);
                    mem_num++;
                    Member(mem_num, [2, ref_column_taper + 1], "", column_params_1);
                    mem_num++;
                };
                Member(mem_num, [ref_column_taper, 1], "", column_params_4);
                mem_num++;
                Member(mem_num, [ref_column_taper + 1, 3], "", column_params_2);
                mem_num++;
            }
            else {
                Member(mem_num, [0, 1], "", column_params_1);
                mem_num++;
                Member(mem_num, [2, 3], "", column_params_1);
                mem_num++;
            };
        }
        else {
            if (column_taper_check == true) {
                if (l_c != H) {
                    Member(mem_num, [0, ref_column_taper], "", column_params_1);
                    mem_num++;
                    Member(mem_num, [2, ref_column_taper + 1], "", column_params_1);
                    mem_num++;
                };
                Member(mem_num, [ref_column_taper, 1], "", column_params_3);
                mem_num++;
                Member(mem_num, [ref_column_taper + 1, 3], "", column_params_3);
                mem_num++;
            }
            else {
                Member(mem_num, [0, 1], "", column_params_1);
                mem_num++;
                Member(mem_num, [2, 3], "", column_params_1);
                mem_num++;
            };
        };
    }
    else {
        if (column_taper == "column_inwards") {
            if (column_taper_check == true) {
                if (l_c_l != H_l) {
                    Member(mem_num, [0, ref_column_taper], "", column_params_1);
                    mem_num++;
                };
                if (l_c_r != H_r) {
                    Member(mem_num, [2, ref_column_taper + 1], "", column_params_1);
                    mem_num++;
                };
                Member(mem_num, [ref_column_taper, 1], "", column_params_2);
                mem_num++;
                Member(mem_num, [ref_column_taper + 1, 3], "", column_params_4);
                mem_num++;
            }
            else {
                Member(mem_num, [0, 1], "", column_params_1);
                mem_num++;
                Member(mem_num, [2, 3], "", column_params_1);
                mem_num++;
            };
        }
        else if (column_taper == "column_outwards") {
            if (column_taper_check == true) {
                if (l_c_l != H_l) {
                    Member(mem_num, [0, ref_column_taper], "", column_params_1);
                    mem_num++;
                };
                if (l_c_r != H_r) {
                    Member(mem_num, [2, ref_column_taper + 1], "", column_params_1);
                    mem_num++;
                };
                Member(mem_num, [ref_column_taper, 1], "", column_params_4);
                mem_num++;
                Member(mem_num, [ref_column_taper + 1, 3], "", column_params_2);
                mem_num++;
            }
            else {
                Member(mem_num, [0, 1], "", column_params_1);
                mem_num++;
                Member(mem_num, [2, 3], "", column_params_1);
                mem_num++;
            };
        }
        else {
            if (column_taper_check == true) {
                if (l_c_l != H_l) {
                    Member(mem_num, [0, ref_column_taper], "", column_params_1);
                    mem_num++;
                };
                if (l_c_r != H_r) {
                    Member(mem_num, [2, ref_column_taper + 1], "", column_params_1);
                    mem_num++;
                };
                Member(mem_num, [ref_column_taper, 1], "", column_params_3);
                mem_num++;
                Member(mem_num, [ref_column_taper + 1, 3], "", column_params_3);
                mem_num++;
            }
            else {
                Member(mem_num, [0, 1], "", column_params_1);
                mem_num++;
                Member(mem_num, [2, 3], "", column_params_1);
                mem_num++;
            };
        };
    };

    // Rafter
    var mem_list = [];

    if (roof_shape == "double_pitch") {
        if (rafter_taper_check == false) {
            Member(mem_num, [1, 4], "", rafter_params_1);
            mem_list.push(members[mem_num]);
            mem_num++;
            Member(mem_num, [3, 4], "", rafter_params_1);
            mem_list.push(members[mem_num]);
            mem_num++;
        }
        else {
            if (rafter_taper_both_side_check == false && full_length_rafter_check == false) {
                if (rafter_taper == "rafter_inwards") {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;

                    Member(mem_num, [ref_rafter_taper, 4], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper + 1, 4], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else if (rafter_taper == "rafter_outwards") {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;

                    Member(mem_num, [ref_rafter_taper, 4], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper + 1, 4], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;

                    Member(mem_num, [ref_rafter_taper, 4], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper + 1, 4], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;

                };
            }
            else if (rafter_taper_both_side_check == true && full_length_rafter_check == false) {
                if (rafter_taper == "rafter_inwards") {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper, ref_tip_rafter_taper], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;

                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper + 1, ref_tip_rafter_taper + 1], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper + 1], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else if (rafter_taper == "rafter_outwards") {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper, ref_tip_rafter_taper], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;

                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper + 1, ref_tip_rafter_taper + 1], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper + 1], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper, ref_tip_rafter_taper], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;

                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [ref_rafter_taper + 1, ref_tip_rafter_taper + 1], "", rafter_params_1);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper + 1], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                };
            }
            else if (rafter_taper_both_side_check == false && full_length_rafter_check == true) {
                if (rafter_taper == "rafter_inwards") {
                    Member(mem_num, [1, 4], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, 4], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else if (rafter_taper == "rafter_outwards") {
                    Member(mem_num, [1, 4], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, 4], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else {
                    Member(mem_num, [1, 4], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, 4], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
            }
            else if (rafter_taper_both_side_check == true && full_length_rafter_check == true) {
                if (rafter_taper == "rafter_inwards") {
                    Member(mem_num, [1, ref_tip_rafter_taper], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, ref_tip_rafter_taper + 1], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper + 1], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else if (rafter_taper == "rafter_outwards") {
                    Member(mem_num, [1, ref_tip_rafter_taper], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, ref_tip_rafter_taper + 1], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper + 1], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else {
                    Member(mem_num, [1, ref_tip_rafter_taper], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [3, ref_tip_rafter_taper + 1], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    Member(mem_num, [4, ref_tip_rafter_taper + 1], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                };
            };
        };
    }
    else {
        if (rafter_taper_check == false) {
            Member(mem_num, [1, 3], "", rafter_params_1);
            mem_list.push(members[mem_num]);
            mem_num++;
        }
        else {
            if (full_length_rafter_check == false) {
                if (rafter_taper == "rafter_inwards") {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    if (nodes[ref_rafter_taper].coordinate_1 != nodes[ref_rafter_taper + 1].coordinate_1) {
                        Member(mem_num, [ref_rafter_taper, ref_rafter_taper + 1], "", rafter_params_1);
                        mem_list.push(members[mem_num]);
                        mem_num++;
                    };
                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else if (rafter_taper == "rafter_outwards") {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    if (nodes[ref_rafter_taper].coordinate_1 != nodes[ref_rafter_taper + 1].coordinate_1) {
                        Member(mem_num, [ref_rafter_taper, ref_rafter_taper + 1], "", rafter_params_1);
                        mem_list.push(members[mem_num]);
                        mem_num++;
                    };
                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else {
                    Member(mem_num, [1, ref_rafter_taper], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                    if (nodes[ref_rafter_taper].coordinate_1 != nodes[ref_rafter_taper + 1].coordinate_1) {
                        Member(mem_num, [ref_rafter_taper, ref_rafter_taper + 1], "", rafter_params_1);
                        mem_list.push(members[mem_num]);
                        mem_num++;
                    };
                    Member(mem_num, [3, ref_rafter_taper + 1], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
            }
            else {
                if (rafter_taper == "rafter_inwards") {
                    Member(mem_num, [1, 3], "", rafter_params_2);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else if (rafter_taper == "rafter_outwards") {
                    Member(mem_num, [1, 3], "", rafter_params_4);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                }
                else {
                    Member(mem_num, [1, 3], "", rafter_params_3);
                    mem_list.push(members[mem_num]);
                    mem_num++;
                };
            };
        };
    };

    // Cantilever
    if (cantilever == true) {
        if (c_l > 0) {
            Member(mem_num, [1, ref_cantilever], "", cantilever_s);
            mem_list.push(members[mem_num]);
            mem_num++;
        };
        if (c_r > 0) {
            Member(mem_num, [3, ref_cantilever + 1], "", cantilever_s);
            mem_list.push(members[mem_num]);
            mem_num++;
        };
    };

    // Assign supports
    nodes[0].support = nodal_supports[1];
    nodes[2].support = nodal_supports[2];

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
    LinearDimension(undefined, nodes[0], nodes[2], "xz", "L", 1, "", linear_dimension_params_1);

    // z dimensions
    if (roof_shape == "double_pitch") {
        LinearDimension(undefined, nodes[0], nodes[1], "zx", "H", 1, "", linear_dimension_params_1);
        LinearDimension(undefined, nodes[1], nodes[4], "zx", "H<sub>c</sub>", L / 2, "", linear_dimension_params_1);

        if (column_taper_check == true) {
            if (H != l_c) {
                LinearDimension(undefined, nodes[2], nodes[ref_column_taper + 1], "zx", "", L - 1, "", linear_dimension_params_1);
            };
            LinearDimension(undefined, nodes[3], nodes[ref_column_taper + 1], "zx", "l<sub>c</sub>", L - 1, "", linear_dimension_params_1);
        };

        if (rafter_taper_check == true) {
            var dim = LinearDimension(undefined, nodes[1], nodes[ref_rafter_taper], "", "l<sub>r</sub>", 1, "", linear_dimension_params_1);
            dim.linear_plane = model.dimensions.PLANE_SECOND;
            var dim = LinearDimension(undefined, nodes[3], nodes[ref_rafter_taper + 1], "", "l<sub>r</sub>", 1, "", linear_dimension_params_1);
            dim.linear_plane = model.dimensions.PLANE_SECOND;

            if (rafter_taper_both_side_check == false && full_length_rafter_check == false) {
                var dim = LinearDimension(undefined, nodes[4], nodes[ref_rafter_taper], "", "", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
                var dim = LinearDimension(undefined, nodes[4], nodes[ref_rafter_taper + 1], "", "", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
            };

            if (rafter_taper_both_side_check == true) {
                if (full_length_rafter_check == false) {
                    var dim = LinearDimension(undefined, nodes[ref_tip_rafter_taper], nodes[ref_rafter_taper], "", "", 1, "", linear_dimension_params_1);
                    dim.linear_plane = model.dimensions.PLANE_SECOND;
                    var dim = LinearDimension(undefined, nodes[ref_tip_rafter_taper + 1], nodes[ref_rafter_taper + 1], "", "", 1, "", linear_dimension_params_1);
                    dim.linear_plane = model.dimensions.PLANE_SECOND;
                };
                var dim = LinearDimension(undefined, nodes[ref_tip_rafter_taper], nodes[4], "", "l<sub>t</sub>", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
                var dim = LinearDimension(undefined, nodes[ref_tip_rafter_taper + 1], nodes[4], "", "l<sub>t</sub>", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
            };

            if (rafter_taper_both_side_check == false && full_length_rafter_check == true) {
                var dim = LinearDimension(undefined, nodes[1], nodes[4], "", "", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
                var dim = LinearDimension(undefined, nodes[3], nodes[4], "", "", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
            };
        };
    }
    else if (roof_shape == "single_pitch") {
        LinearDimension(undefined, nodes[0], nodes[1], "zx", "H<sub>L</sub>", 2, "", linear_dimension_params_1);
        LinearDimension(undefined, nodes[2], nodes[3], "zx", "H<sub>R</sub>", L + 2, "", linear_dimension_params_1);

        if (column_taper_check == true) {
            if (H_l != l_c_l) {
                LinearDimension(undefined, nodes[0], nodes[ref_column_taper], "zx", "", 1, "", linear_dimension_params_1);
            };
            if (H_r != l_c_r) {
                LinearDimension(undefined, nodes[2], nodes[ref_column_taper + 1], "zx", "", L + 1, "", linear_dimension_params_1);
            };
            if (full_length_column_check == false) {
                LinearDimension(undefined, nodes[1], nodes[ref_column_taper], "zx", "l<sub>c,L</sub>", 1, "", linear_dimension_params_1);
                LinearDimension(undefined, nodes[3], nodes[ref_column_taper + 1], "zx", "l<sub>c,R</sub>", L + 1, "", linear_dimension_params_1);
            };


            if (rafter_taper_check == false) {
                var dim = LinearDimension(undefined, nodes[1], nodes[3], "", "", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
            }
            else {
                if (full_length_rafter_check == true) {
                    var dim = LinearDimension(undefined, nodes[1], nodes[3], "", "", 1, "", linear_dimension_params_1);
                    dim.linear_plane = model.dimensions.PLANE_SECOND;
                }
                else {
                    var dim = LinearDimension(undefined, nodes[1], nodes[ref_rafter_taper], "", "l<sub>r</sub>", 1, "", linear_dimension_params_1);
                    dim.linear_plane = model.dimensions.PLANE_SECOND;
                    var dim = LinearDimension(undefined, nodes[3], nodes[ref_rafter_taper + 1], "", "l<sub>r</sub>", 1, "", linear_dimension_params_1);
                    dim.linear_plane = model.dimensions.PLANE_SECOND;
                    var dim = LinearDimension(undefined, nodes[ref_rafter_taper], nodes[ref_rafter_taper + 1], "", "", 1, "", linear_dimension_params_1);
                    dim.linear_plane = model.dimensions.PLANE_SECOND;
                };
            };
        };
    }
    else {
        LinearDimension(undefined, nodes[0], nodes[1], "zx", "H", 1, "", linear_dimension_params_1);

        if (column_taper_check == true) {
            if (H != l_c) {
                LinearDimension(undefined, nodes[2], nodes[ref_column_taper + 1], "zx", "", L - 1, "", linear_dimension_params_1);
            };
            LinearDimension(undefined, nodes[3], nodes[ref_column_taper + 1], "zx", "l<sub>c</sub>", L - 1, "", linear_dimension_params_1);
        };

        if (rafter_taper_check == false) {
            var dim = LinearDimension(undefined, nodes[1], nodes[3], "", "", 1, "", linear_dimension_params_1);
            dim.linear_plane = model.dimensions.PLANE_SECOND;
        }
        else {
            if (full_length_rafter_check == true) {
                var dim = LinearDimension(undefined, nodes[1], nodes[3], "", "", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
            }
            else {
                var dim = LinearDimension(undefined, nodes[1], nodes[ref_rafter_taper], "", "l<sub>r</sub>", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
                var dim = LinearDimension(undefined, nodes[3], nodes[ref_rafter_taper + 1], "", "l<sub>r</sub>", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
                var dim = LinearDimension(undefined, nodes[ref_rafter_taper], nodes[ref_rafter_taper + 1], "", "", 1, "", linear_dimension_params_1);
                dim.linear_plane = model.dimensions.PLANE_SECOND;
            };
        };
    };

    if (cantilever == true) {
        if (c_l > 0) {
            var dim = LinearDimension(undefined, nodes[1], nodes[ref_cantilever], "", "c<sub>L</sub>", 1, "", linear_dimension_params_1);
            dim.linear_plane = model.dimensions.PLANE_SECOND;
        };
        if (c_r > 0) {
            var dim = LinearDimension(undefined, nodes[3], nodes[ref_cantilever + 1], "", "c<sub>R</sub>", 1, "", linear_dimension_params_1);
            dim.linear_plane = model.dimensions.PLANE_SECOND;
        };
    };

    //
    // Create loads
    //  

    var load_case = load_cases[1];
    if (load_case) {
        var live_load_on_members = MemberLoad(1, load_case);
        live_load_on_members.magnitude = magnitude_w;
        live_load_on_members.members = mem_list;

        var live_load = NodalLoad(1, load_case);
        live_load.load_type = model.nodal_loads.LOAD_TYPE_COMPONENTS;
        live_load.components_force_x = force_x;
        live_load.components_force_z = force_z;
        live_load.nodes = [nodes[1], nodes[3]];
    };

    var snow_load_case = load_cases[2];
    if (snow_load_case) {
        var snow_load = MemberLoad(2, snow_load_case);
        snow_load.magnitude = magnitude_s;
        snow_load.members = mem_list;
    };
}