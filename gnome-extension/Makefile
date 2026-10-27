UUID    := ghub-battery@vinipy12.github.io
RUNTIME := extension.js prefs.js stylesheet.css upowerSource.js model.js panelItem.js menu.js notifier.js
SCHEMA  := schemas/org.gnome.shell.extensions.ghub-battery.gschema.xml

.PHONY: test test-live schemas pack install nested clean

test:
	gjs -m tests/run.js

test-live:
	gjs -m tests/upowerSource.live.test.js

schemas:
	glib-compile-schemas --strict schemas/
