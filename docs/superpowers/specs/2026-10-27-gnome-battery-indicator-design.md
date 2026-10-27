# GNOME Battery Indicator for Logitech Peripherals — Design

Date: 2026-10-27
Status: approved for planning

## Problem

The repo ships a Windows 11 widget, a .NET CLI and a Python CLI. All three read
the Logitech G HUB agent's local WebSocket (`ws://127.0.0.1:9010`). That agent
does not exist on Linux, so on Ubuntu there is no data source and no interface.

Ubuntu already exposes Logitech peripherals' batteries through UPower: the
kernel `hid-logitech-hidpp` driver creates a `hidpp_battery_N` power supply for
each device paired to a Lightspeed/Unifying receiver, and BlueZ-paired devices
appear as UPower `keyboard`/`headset`/`mouse` devices. Captured on the reference
machine (Ubuntu 24.04.5, GNOME Shell 46, X11):

| Device | Transport | UPower type | Percentage | Notes |
|---|---|---|---|---|
| G305 Lightspeed Wireless Gaming Mouse | USB receiver 046d:c53f | mouse | 100%, flagged "should be ignored" | `battery-level: full` (coarse) |
| G515 LS TKL | Bluetooth | keyboard | 35% | exact |
| G435 Bluetooth Gaming Headset | Bluetooth | headset | 60% | exact |

UPower exposes no vendor field for these devices.

## Goal

A GNOME Shell extension that shows each battery-reporting peripheral in the top
bar, updates on UPower events, colors low batteries, and notifies once per
crossing below 20%. Zero runtime dependencies beyond GNOME Shell 45/46 and
UPower.

## Decisions taken

- Form factor: GNOME top-bar indicator (Shell extension), not a floating window.
- Data source: UPower over D-Bus only. Direct HID++ (exact mouse percentage,
  mW, hours) is a later, separate project. The device model is shaped so a
  second source can be added beside UPower.
- Panel: one item per device (icon + value), neutral color normally, amber and
  red when low. Inactive devices leave the panel and show greyed in the dropdown.
- Alerts: one GNOME notification per device per crossing below 20%, re-armed
  when the device charges or rises above 20%. Default on, toggle in prefs.
- Architecture: pure GJS, D-Bus directly to UPower. No helper process, no
  polling, no Python.

## Layout

New folder `gnome-extension/`, beside `cli/` and `src/`.
UUID: `ghub-battery@vinipy12.github.io`.

| File | Responsibility |
|---|---|
| `metadata.json` | name, uuid, `shell-version: ["45","46"]`, `settings-schema` |
| `extension.js` | Shell entry point. `enable()` creates the source, panel items, notification source and settings bindings; `disable()` tears all of them down. No logic. |
| `upowerSource.js` | D-Bus client for `org.freedesktop.UPower`. `EnumerateDevices` once at start; thereafter `DeviceAdded`, `DeviceRemoved` and per-device `PropertiesChanged`. Emits `changed(devices)` with raw property maps. Watches name-owner changes to recover when upowerd restarts. |
| `model.js` | Shell-free pure functions (see Model). |
| `panelItem.js` | One `PanelMenu.Button` per device: category icon, value label, color CSS class, bolt when charging. Opens the shared menu. |
| `menu.js` | Dropdown listing every known device (active and inactive) with value, state, last-updated; Preferences entry. |
| `prefs.js` + `schemas/org.gnome.shell.extensions.ghub-battery.gschema.xml` | Keys: `notify-low` (bool, default true), `show-inactive` (bool, default true). |
| `stylesheet.css` | `.ghub-battery-amber`, `.ghub-battery-red`, `.ghub-battery-inactive`, using GNOME palette variables so light and dark both work. |
| `tests/` | `gjs -m` scripts + JSON fixtures (see Testing). |
| `Makefile` | `pack`, `install`, `test`, `nested`. |
| `README.md` | Portuguese, matching the repo. Root README gains an install section. |

## Model (`model.js`)

Input: a map of UPower object path -> properties
(`Type`, `Model`, `Serial`, `Percentage`, `BatteryLevel`, `State`,
`IsPresent`, `PowerSupply`, `UpdateTime`, and the "percentage should be
ignored" flag derived from `BatteryLevel != none`).

Output device record:

```
{ id, name, kind, percent, level, charging, present, updatedAt, source: "upower" }
```

- `id`: UPower object path. `name`: `Model`, falling back to `Serial`.
- `kind`: one of `mouse | keyboard | headset | gaming-input | other`, from
  UPower `Type`.
- `percent`: number, or `null` when UPower reports a coarse `BatteryLevel`
  (i.e. the percentage is to be ignored).
- `level`: `full | high | normal | low | critical | null`.
- `charging`: `State` is charging or fully-charged.
- `present`: `IsPresent` and `State != unknown`.

Filter rule: a device counts when `PowerSupply` is false and `kind != other`
or `Type` is any peripheral type (mouse, keyboard, headset, gaming-input,
speakers, phone, media-player, tablet, computer excluded). Laptop batteries
and line power never show. No vendor filter.

Display rules:
- Value label: `NN%` when `percent` is a number; otherwise the coarse word
  (`Cheia`, `Alta`, `Normal`, `Baixa`, `Crítica`). Charging prefixes `⚡`.
- Color band: `normal` above 50; `amber` from 50 down to 21; `red` at 20 and
  below. Coarse: `low` -> amber, `critical` -> red, others normal. Charging
  always `normal`.
- Panel order: mouse, keyboard, headset, gaming-input, other; alphabetical by
  name within a kind. Stable across updates.
- Not-present devices are excluded from the panel; the menu keeps the
  last-seen record for the session, greyed, labelled `Inativo`.

Alert rule (pure, `(prev, next) -> boolean`):
- Fire when `prev` was above threshold (or unknown) and `next` is at or below
  20% while not charging; or when coarse level first becomes `critical`.
- Re-arm when `next` is above 20%, charging, or level is no longer critical.
- Never fire twice without a re-arm in between.

## Data flow

1. `enable()` -> `UPowerSource.start()` -> `EnumerateDevices` -> `changed`.
2. `extension.js` runs `model.normalize` then diffs against current items:
   added -> new `PanelItem`; removed/not-present -> destroy item, keep menu
   row greyed; changed -> update label/color in place.
3. For each device, `model.shouldAlert(prev, next)`; on true, emit a
   notification via the extension's `MessageTray.Source`, if `notify-low`.
4. Every subsequent UPower signal repeats steps 2-3 with a fresh snapshot.

## Error handling

- UPower not on the bus at enable: single grey panel item, menu shows
  `UPower indisponível`; `NameOwnerChanged` triggers a restart of the source.
- A device's `PropertiesChanged` with a partial payload merges into the cached
  property map; a missing `Percentage` never produces `NaN` labels.
- `disable()` disconnects every signal, destroys every actor and the
  notification source, and nulls references, as GNOME extension review
  requires.

## Testing

- `make test` runs `gjs -m tests/*.test.js` with no Shell imports. Fixtures
  are JSON captures of real UPower property sets: the three devices above, plus
  the G515 over the receiver once captured. Coverage: filter, normalize,
  label, color band, ordering, and alert arming across state sequences
  (drop to 19, hold at 19, charge, drop again).
- `tests/upowerSource.live.test.js` runs against the live system bus and
  asserts at least one peripheral enumerates; skipped when UPower is absent.
- Manual: nested session via `make nested`
  (`dbus-run-session -- gnome-shell --nested --wayland`), then real-session
  `make install && gnome-extensions enable ghub-battery@vinipy12.github.io`.

## Packaging

- `make pack` -> `gnome-extensions pack` with compiled schema, output
  `ghub-battery@vinipy12.github.io.shell-extension.zip`.
- `.github/workflows/build-and-release.yml` gains a job that packs the
  extension and attaches the zip to the release. No extensions.gnome.org
  submission in this scope.

## Out of scope

HID++ direct access, power draw (mW), estimated hours, the floating window,
autostart handling, GNOME before 45, Ubuntu before 24.04.
