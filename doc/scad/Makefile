# Desk-HUD printed stand -- build every STL and run the interference checks.
# Requires OpenSCAD (https://openscad.org). Tested with OpenSCAD 2021.01.
#
#   make          export all STLs into ../stl and run the checks
#   make stl      only export the STLs
#   make check    only run the interference checks
#
# Change a parameter in desk-hud-stand.scad (e.g. pi_depth) and run `make`
# to regenerate everything.

OPENSCAD ?= openscad
SRC      := desk-hud-stand.scad
OUT      := ../stl

STLS := $(OUT)/desk-hud-stand.stl \
        $(OUT)/desk-hud-stand-lens-down.stl \
        $(OUT)/desk-hud-stand-bar.stl \
        $(OUT)/desk-hud-stand-clips.stl \
        $(OUT)/desk-hud-stand-fit-test.stl \
        $(OUT)/desk-hud-stand-bar-fit-test.stl

.PHONY: all stl check clean
all: stl check
stl: $(STLS)

$(OUT)/desk-hud-stand.stl:               PART = stand
$(OUT)/desk-hud-stand-lens-down.stl:     PART = stand_lensdown
$(OUT)/desk-hud-stand-bar.stl:           PART = bar
$(OUT)/desk-hud-stand-clips.stl:         PART = clips
$(OUT)/desk-hud-stand-fit-test.stl:      PART = test
$(OUT)/desk-hud-stand-bar-fit-test.stl:  PART = bar_test

$(OUT)/%.stl: $(SRC)
	@mkdir -p $(OUT)
	$(OPENSCAD) -D 'PART="$(PART)"' -o $@ $(SRC)

# Each check intersects parts that must NOT overlap. OpenSCAD reports an
# empty result when they don't.
check:
	@for p in collide joint clips_collide; do \
	  if $(OPENSCAD) -D "PART=\"$$p\"" -o $(OUT)/.check.stl $(SRC) 2>&1 | grep -q "top level object is empty"; then \
	    echo "OK    $$p: no interference"; \
	  else \
	    echo "FAIL  $$p: parts overlap -- see desk-hud-stand.scad"; exit 1; \
	  fi; \
	done; rm -f $(OUT)/.check.stl

clean:
	rm -f $(STLS) $(OUT)/.check.stl
