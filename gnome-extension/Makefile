UUID    := ghub-battery@vinipy12.github.io
RUNTIME := extension.js prefs.js stylesheet.css upowerSource.js model.js panelItem.js menu.js notifier.js
SCHEMA  := schemas/org.gnome.shell.extensions.ghub-battery.gschema.xml

.PHONY: test test-live test-race schemas pack install nested clean

test:
	gjs -m tests/run.js

test-race:
	gjs -m tests/upowerSource.race.test.js

test-live:
	gjs -m tests/upowerSource.live.test.js

schemas:
	glib-compile-schemas --strict schemas/

pack: schemas
	gnome-extensions pack -f \
	  $(foreach f,$(filter-out extension.js prefs.js stylesheet.css,$(RUNTIME)),--extra-source=$(f)) \
	  --schema=$(SCHEMA) \
	  -o .
	@unzip -l $(UUID).shell-extension.zip > /tmp/ghub-pack.lst
	@for f in metadata.json $(RUNTIME) $(SCHEMA); do \
	  grep -q " $$f$$" /tmp/ghub-pack.lst || { echo "MISSING $$f in zip"; exit 1; }; done
	@echo "packed $(UUID).shell-extension.zip"

install: pack
	gnome-extensions install -f $(UUID).shell-extension.zip
	@echo "Installed. On X11 press Alt+F2, type r, Enter; then: gnome-extensions enable $(UUID)"

nested:
	dbus-run-session -- gnome-shell --nested --wayland

clean:
	rm -f $(UUID).shell-extension.zip schemas/gschemas.compiled
