// =====================================================================
// Desk-HUD 3D-printed stand  (Waveshare 11.9" HDMI LCD, 1480x320)
//
// Parametric OpenSCAD source for every printable part:
//   stand   one-piece 45 degree stand (the main part)
//   bar     separate rear tie bar, slides into dovetail sockets
//   clips   4 snap-on retaining clips for the top edge of the screen
// plus export helpers (lens-down print orientation, fit-test pieces)
// and interference checks. See doc/install_stand.md.
//
// Build:   make            (exports ../stl/*.stl and runs the checks)
// Or pick a part by hand:  openscad -D 'PART="stand"' -o stand.stl desk-hud-stand.scad
//
// Concept: a tilted plate with
//   * a through-window sized for the panel's inner lip / LCD module
//     (so the module, PCB and the Pi hang through the plate, open back)
//   * a thin ledge that carries the underside of the glass lens
//   * a continuous ridge around the lens outer edge
// ...held up by two triangular end cheeks and a front apron, tied
// together at the back by a separate dovetailed bar.
//
// Panel dimensions come from the Waveshare STEP model + 2D drawing
// (not redistributed here). The numbers you are most likely to tune
// are in the PARAMETERS block -- especially pi_depth.
// Coordinates: panel frame u = along the long edge, v = up the screen
// from the lens bottom edge, w = out of the lens face (0 = lens front).
// =====================================================================

$fn = 64;

// ---------------------- PARAMETERS -----------------------------------

tilt = 45;            // screen tilt from vertical (45 = half-way back)

// --- panel (from STEP; w = 0 at the lens front face, negative = behind)
lens_w   = 287.3;     // glass outer width
lens_h   = 69.8;      // glass outer height
lens_t   = 1.12;      // glass thickness (underside at w = -lens_t)
lens_r   = 3.0;       // glass corner radius (drawing: 4 x R3)
lip_w    = 285.8;     // layer under the glass ("inner lip")
lip_h    = 67.6;
lip_u_max = 143.22;   // widest extent of that layer from centre in the STEP
mod_w    = 282.0;     // LCD module behind the lip
mod_h    = 65.0;
// PCB + connectors envelope (worst case, used for clearance only)
pcb_u0   = -63.5;  pcb_u1 = 58.5;     // along the long axis
pcb_v0   = 1.67;   pcb_v1 = lens_h - 1.67;
pcb_w0   = -15.95; pcb_w1 = -7.02;    // deepest connector -> PCB face

// --- fit clearances
pk_clr   = 0.30;      // glass pocket clearance, per side
win_clr  = 0.30;      // window clearance around the lip, per side
win_r    = 0.5;       // window corner radius (lip layer corners are square)
ledge_gap= 0.03;      // ledge sits this far below the glass underside

// --- stand geometry
plate_t  = 4.5;       // thickness of the plate under the ledge
ridge_w  = 2.4;       // ridge thickness along the bottom edge
ridge_top_w = 5.0;    // wider along the TOP edge: it spans the full length
                      // unsupported, so it is made stiffer
ridge_up = 0.4;       // ridge stands this far proud of the lens face
cheek_t  = 5.0;       // end cheek thickness (sets overall length)
apron_on = true;      // front wall joining the cheeks

// --- rear tie bar: a SEPARATE piece that slides into a dovetail socket
//     in a boss on the inside of each cheek (inserted from the rear)
bosses_on = true;     // false = no sockets (print without the bar)
bar_d    = 10;        // bar depth, front to back (y)
bar_h    = 12;        // bar height (z)
dt_neck  = 5;         // dovetail neck width (z)
dt_depth = 3.5;       // dovetail depth (x); 45 deg flanks -> no supports
dt_zc    = 9.5;       // height of the dovetail centre above the desk
dt_clr_rear  = 0.45;  // socket clearance at the rear opening (easy start)
dt_clr_front = 0.10;  // socket clearance at the front stop (wedges snug)
bar_gap  = 0.25;      // gap between bar end and boss face
bar_chamfer = 4;      // 45 deg chamfer on the bar's top-front edge: keeps it
                      // clear of the Pi stack hanging behind the screen
boss_w   = 8;         // boss thickness, inward from the cheek (x)
boss_h   = 20;
boss_d   = 13;        // boss depth, front to back (y)
desk_clear = 5;       // min. gap between lowest PCB/connector and desk

// --- Raspberry Pi 5 + cooler mounted on the back of the display.
//     MEASURE pi_depth: lay the display lens-down on a table and measure
//     the height of the highest part of the Pi / cooler above the table.
pi_depth = 44;        // reach of the Pi stack behind the LENS FRONT (mm)
pi_v0    = 5.4;       // height of the Pi's bottom edge above the lens's bottom edge
pi_clear = 4;         // clearance between the Pi stack and the table
extra_lift = 0;       // any additional lift on top of the computed height

// ---------------------- DERIVED ---------------------------------------

s = sin(tilt);
c = cos(tilt);

// glass pocket + window, in panel coordinates (u = along length, v = up
// the screen from the lens bottom edge, w = out of the lens face)
pk_w   = lens_w + 2*pk_clr;
pk_v0  = -pk_clr;
pk_v1  = lens_h + pk_clr;
op_w   = 2*(lip_u_max + win_clr);   // window width (lip is slightly
                                    // off-centre in the STEP, use its max)
op_h   = lip_h + 2*win_clr;
op_v0  = (lens_h - op_h)/2;
op_v1  = op_v0 + op_h;

w_top  = ridge_up;                   // ridge top
w_led  = -lens_t - ledge_gap;        // ledge (glass rests here)
w_bot  = w_led - plate_t;            // plate underside

v_lo   = pk_v0 - ridge_w;            // plate edges along v
v_hi   = pk_v1 + ridge_top_w;
cheek_out = op_w/2 + cheek_t;        // half overall length

dt_wide    = dt_neck + 2*dt_depth;   // 45 deg flanks
x_c        = op_w/2;                 // cheek inner face
x_b        = x_c - boss_w;           // boss inner face (faces the centre)
groove_len = bar_d + 0.6;

// height of panel origin above the desk: lowest connector clears desk
z0 = max(desk_clear - (pcb_v0*c + pcb_w0*s),
         3 - (v_lo*c + w_bot*s),
         pi_clear - (pi_v0*c - pi_depth*s)) + extra_lift;
y0 = 0;

function tf(u,v,w) = [u, y0 + v*s - w*c, z0 + v*c + w*s];

// panel frame -> world
module placed() {
    multmatrix([[1,0,0,0],
                [0,s,-c,y0],
                [0,c, s,z0],
                [0,0,0,1]]) children();
}

module rrect(w, h, r) {
    offset(r = r) square([w - 2*r, h - 2*r], center = true);
}

// ---------------------- PANEL-FRAME SOLIDS ----------------------------

module plate_body() {
    translate([0, 0, w_bot])
        linear_extrude(height = w_top - w_bot)
            translate([0, (v_lo + v_hi)/2])
                rrect(2*cheek_out, v_hi - v_lo, 5);
}

module pocket_void() {
    translate([0, 0, w_led])
        linear_extrude(height = w_top - w_led + 2)
            translate([0, (pk_v0 + pk_v1)/2])
                rrect(pk_w, pk_v1 - pk_v0, lens_r + pk_clr);
}

module window_void() {
    translate([0, 0, w_bot - 1])
        linear_extrude(height = w_top - w_bot + 4)
            translate([0, (op_v0 + op_v1)/2])
                rrect(op_w, op_h, win_r);
}

// ---------------------- WORLD-FRAME SUPPORT ---------------------------

A = tf(0, v_lo, w_top);   // front-top corner of plate
B = tf(0, v_lo, w_bot);   // front-bottom corner
C = tf(0, v_hi, w_bot);   // rear-bottom corner
D = tf(0, v_hi, w_top);   // rear-top corner

// side profile polygon is in (y, z); extrude along x
module profile_prism(x0, x1, pts) {
    translate([x0, 0, 0])
        rotate([90, 0, 90])
            linear_extrude(height = x1 - x0)
                polygon(pts);
}

module cheeks() {
    pts = [[A[1], 0], [C[1], 0], [C[1], C[2]], [D[1], D[2]], [A[1], A[2]]];
    profile_prism(-cheek_out, -op_w/2, pts);
    profile_prism( op_w/2,  cheek_out, pts);
}

module apron() {
    pts = [[A[1], 0], [B[1], 0], [B[1], B[2]], [A[1], A[2]]];
    profile_prism(-cheek_out, cheek_out, pts);
}

// y of the cheek rear face / bar front stop (set after C is known)
y_rear = C[1];
y_f    = y_rear - groove_len;

function dt_poly() = [
    [x_b - 1,        dt_zc - dt_neck/2],
    [x_b,            dt_zc - dt_neck/2],
    [x_b + dt_depth, dt_zc - dt_wide/2],
    [x_b + dt_depth, dt_zc + dt_wide/2],
    [x_b,            dt_zc + dt_neck/2],
    [x_b - 1,        dt_zc + dt_neck/2]
];

module bosses() {
    for (m = [0, 1]) mirror([m, 0, 0])
        translate([x_b, y_rear - boss_d, 0])
            cube([boss_w + 0.01, boss_d, boss_h]);
}

// tapered dovetail socket: open at the rear, closed (stop) at the front
module socket() {
    N = 10; sl = groove_len / N;
    for (m = [0, 1]) mirror([m, 0, 0])
        for (i = [0 : N - 1]) {
            c = dt_clr_rear + (dt_clr_front - dt_clr_rear) * i / (N - 1);
            translate([0, y_rear - i*sl + (i == 0 ? 1 : 0), 0])
                rotate([90, 0, 0])
                    linear_extrude(height = sl + 0.02 + (i == 0 ? 1 : 0))
                        offset(delta = c) polygon(dt_poly());
        }
}

// the separate rear tie bar (assembled position)
module bar() {
    hl = x_b - bar_gap;
    zlo = dt_zc - bar_h/2; zhi = dt_zc + bar_h/2;
    translate([-hl, 0, 0]) rotate([90, 0, 90])
        linear_extrude(height = 2*hl)
            polygon([[y_f, zlo], [y_f + bar_d, zlo], [y_f + bar_d, zhi],
                     [y_f + bar_chamfer, zhi], [y_f, zhi - bar_chamfer]]);
    for (m = [0, 1]) mirror([m, 0, 0])
        translate([0, y_f + bar_d, 0]) rotate([90, 0, 0])
            linear_extrude(height = bar_d)
                polygon([[hl - 0.5,        dt_zc - dt_neck/2],
                         [x_b,             dt_zc - dt_neck/2],
                         [x_b + dt_depth,  dt_zc - dt_wide/2],
                         [x_b + dt_depth,  dt_zc + dt_wide/2],
                         [x_b,             dt_zc + dt_neck/2],
                         [hl - 0.5,        dt_zc + dt_neck/2]]);
}

// bar laid on its rear face for printing: dovetails run vertically,
// so there are no overhangs at all
module bar_for_print() {
    translate([0, 0, -y_f]) rotate([90, 0, 0]) bar();
}

// ---------------------- THE STAND -------------------------------------

module stand() {
    difference() {
        union() {
            placed() plate_body();
            cheeks();
            if (apron_on) apron();
            if (bosses_on) bosses();
        }
        placed() pocket_void();
        placed() window_void();
        if (bosses_on) socket();
    }
}

// ---------------------- REFERENCE PANEL MODEL -------------------------
// Simplified stack built from STEP measurements, used only for
// collision checks / preview. Not exported.

module panel_model(with_pcb = true) {
    placed() {
        // lens
        translate([0, lens_h/2, -lens_t])
            linear_extrude(height = lens_t) rrect(lens_w, lens_h, lens_r);
        // lip layer
        translate([-lip_w/2, (lens_h - lip_h)/2, -2.02]) cube([lip_w, lip_h, 2.02 - lens_t]);
        // LCD module
        translate([-mod_w/2, (lens_h - mod_h)/2, -10.77]) cube([mod_w, mod_h, 10.77 - 2.02]);
        // PCB + connector envelope
        if (with_pcb)
            translate([pcb_u0, pcb_v0, pcb_w0])
                cube([pcb_u1 - pcb_u0, pcb_v1 - pcb_v0, pcb_w1 - pcb_w0]);
    }
}

// Pi 5 + cooler envelope (clearance checking only): 85 x 56 board on the
// display's mounting holes, conservative in length.
module pi_model() {
    placed() translate([-62, pi_v0, -pi_depth])
        cube([124, 56.2, pi_depth - 7.02]);
}


// =====================================================================
// SNAP-ON RETAINING CLIPS (print separately, press on after the screen
// is seated). They hook onto the TOP-EDGE strip of the plate:
//   * a lip reaches over the top edge of the lens (black border only)
//   * a flexing finger runs down the back face of the strip and a
//     barb clicks in under it
// Profile is drawn in the panel's (v, w) plane and extruded along the
// length of the screen (clip_w). Printed standing on end so the layers
// run along the finger (strong, no delamination).
// =====================================================================
clip_w     = 14;      // clip width along the screen
clip_x     = [-130, -85, 85, 130];  // positions (keep clear of the PCB/HDMI, |x|<70)
clip_reach = 4.0;     // how far the lip reaches over the lens edge
clip_gap   = 0.45;    // lip bottom height above the lens face
clip_leg_t = 1.6;     // thickness of the lip / top leg
clip_f_root = 1.2;    // finger thickness at the root
clip_f_tip  = 0.8;    // finger thickness at the tip
clip_barb  = 0.7;     // barb protrusion (how far it deflects to snap on)
clip_fgap  = 0.2;     // clearance between finger and strip rear face

function clip_pts() =
    let(
        w_leg_b = w_top + 0.05,                // leg sits on the ridge top
        w_leg_t = w_leg_b + clip_leg_t,
        v_tip   = pk_v1 - clip_reach,          // lip tip (over the lens)
        v_fi    = v_hi + clip_fgap,            // finger inner face
        w_c     = w_bot - 0.10,                // barb catch face (under strip)
        w_ft    = w_c - 2.45                   // finger tip
    ) [
        [v_tip,               w_leg_b],
        [v_tip,               w_leg_t],
        [v_fi + clip_f_root,  w_leg_t],
        [v_fi + clip_f_tip,   w_ft],
        [v_fi,                w_ft],
        [v_fi,                w_c - 1.0 - 0.0],   // start of lead-in ramp
        [v_fi - clip_barb,    w_c - 0.30],        // barb tip (bottom)
        [v_fi - clip_barb,    w_c],               // barb tip (top)
        [v_fi,                w_c],               // catch face meets finger
        [v_fi,                w_leg_b]
    ];

// clip in the assembled position (panel frame -> world)
module clip_assembled(xc) {
    placed() translate([xc - clip_w/2, 0, 0])
        rotate([90, 0, 90]) linear_extrude(height = clip_w) polygon(clip_pts());
}

// clip for printing: profile flat on the bed, extruded UP
module clip_print() {
    linear_extrude(height = clip_w) polygon(clip_pts());
}

// ---------------------- EXPORT SELECTOR -------------------------------
// "stand"   full stand
// "test"    60 mm end section with a full cross-section, to test-fit a
//           corner of the real panel before committing to the big print
// "preview" stand + ghost panel for viewing
// "collide" stand intersected with the panel (should come out EMPTY)

PART = "preview";

if (PART == "stand") {
    stand();
} else if (PART == "bar") {
    bar_for_print();
} else if (PART == "test") {
    // 62 mm end section incl. one boss + socket
    intersection() {
        stand();
        translate([-cheek_out - 1, -50, -1]) cube([62, 200, 200]);
    }
} else if (PART == "bar_test") {
    // 30 mm length of bar end with its dovetail, to try in the end section
    translate([0, 0, -y_f])
        rotate([90, 0, 0])
            intersection() {
                bar();
                translate([-x_b - dt_depth - 2, y_f - 1, 0]) cube([32 + dt_depth, bar_d + 2, 40]);
            }
} else if (PART == "stand_lensdown") {
    // stand rotated so the lens face is on the bed (support-free print;
    // needs a bed of about 300 x 100 mm). Exact: the ridge top plane
    // (w = ridge_up) becomes z = 0.
    multmatrix([[-1, 0, 0, 0],
                [ 0, s, c, -(s*y0 + c*z0)],
                [ 0, c,-s, ridge_up - c*y0 + s*z0],
                [ 0, 0, 0, 1]]) stand();
} else if (PART == "clips") {
    // 2 x 2 print plate
    for (i = [0:3]) translate([(i % 2) * 22, floor(i / 2) * 22, 0]) clip_print();
} else if (PART == "clips_asm") {
    for (xc = clip_x) clip_assembled(xc);
} else if (PART == "panel") {
    panel_model(true);
} else if (PART == "pi") {
    pi_model();
} else if (PART == "none") {
    // nothing (lets other files `include` the modules)
} else if (PART == "collide") {
    intersection() { union() { stand(); bar(); } union() { panel_model(true); pi_model(); } }
} else if (PART == "clips_collide") {
    // clips vs. stand, bar, screen and Pi: should be EMPTY
    intersection() {
        union() { stand(); bar(); panel_model(true); pi_model(); }
        for (xc = clip_x) clip_assembled(xc);
    }
} else if (PART == "joint") {
    intersection() { stand(); bar(); }
} else {
    stand();
    color("orange") bar();
    %panel_model(true);
    %pi_model();
    color("seagreen") for (xc = clip_x) clip_assembled(xc);
}
