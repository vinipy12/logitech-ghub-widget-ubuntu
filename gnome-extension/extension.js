import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {UPowerSource} from './upowerSource.js';
import {isPeripheral, normalize, sortRecords, alertStep, labelFor} from './model.js';
import {buildRows} from './menu.js';
import {PanelItem} from './panelItem.js';
import {Notifier} from './notifier.js';

const ROLE_PREFIX = 'ghub-battery-';
const FALLBACK_RECORD = {
    id: '__fallback__', name: 'Logitech G Battery', kind: 'other',
    percent: null, level: null, state: 0, charging: false, active: false, source: 'upower',
};

export default class GhubBatteryExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._known = new Map();     // id -> record (removed devices kept inactive)
        this._armed = new Map();     // id -> boolean
        this._items = [];            // PanelItem[] in panel order
        this._available = false;
        this._notifier = new Notifier();
        this._source = new UPowerSource(snapshot => this._onSnapshot(snapshot));
        this._render();
        this._source.start();
    }

    disable() {
        this._source?.stop();
        this._source = null;
        this._destroyItems();
        this._notifier?.destroy();
        this._notifier = null;
        this._known = null;
        this._armed = null;
        this._settings = null;
    }

    _onSnapshot({available, devices, removed}) {
        this._available = available;
        for (const id of removed) {
            const prev = this._known.get(id);
            if (prev)
                this._known.set(id, {...prev, active: false});
        }
        for (const [path, props] of devices) {
            if (!isPeripheral(props)) {
                this._known.delete(path);
                continue;
            }
            const record = normalize(path, props);
            this._known.set(path, record);
            this._maybeAlert(record);
        }
        this._render();
    }

    _maybeAlert(record) {
        const armed = this._armed.get(record.id) ?? true;
        const step = alertStep(armed, record);
        this._armed.set(record.id, step.armed);
        if (step.fire && this._settings.get_boolean('notify-low'))
            this._notifier.notify(`${record.name}: bateria fraca`, `Nível atual: ${labelFor(record)}`);
    }

    _rows() {
        return buildRows([...this._known.values()], {
            available: this._available,
            showInactive: this._settings.get_boolean('show-inactive'),
        });
    }

    _itemOpts() {
        return {getRows: () => this._rows(), openPrefs: () => this.openPreferences()};
    }

    _render() {
        const active = sortRecords([...this._known.values()].filter(r => r.active));
        const wanted = active.length > 0 ? active : [FALLBACK_RECORD];
        const currentIds = this._items.map(i => i.recordId);
        const wantedIds = wanted.map(r => r.id);
        const sameOrder = currentIds.length === wantedIds.length
            && currentIds.every((id, i) => id === wantedIds[i]);

        if (sameOrder) {
            wanted.forEach((r, i) => this._items[i].update(r));
            return;
        }
        this._destroyItems();
        wanted.forEach((r, i) => {
            const item = new PanelItem(r, this._itemOpts());
            Main.panel.addToStatusArea(`${ROLE_PREFIX}${i}`, item, i, 'right');
            this._items.push(item);
        });
    }

    _destroyItems() {
        for (const item of this._items)
            item.destroy();
        this._items = [];
    }
}
