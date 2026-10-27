// Pure functions over UPower.Device property objects. No Shell imports.
import UPowerGlib from 'gi://UPowerGlib';

const Kind = UPowerGlib.DeviceKind;
const Level = UPowerGlib.DeviceLevel;
const State = UPowerGlib.DeviceState;

const EXCLUDED_TYPES = new Set([
    Kind.UNKNOWN, Kind.LINE_POWER, Kind.UPS, Kind.MONITOR, Kind.COMPUTER,
]);

export function isPeripheral(props) {
    if (props.PowerSupply !== false)
        return false;
    if (typeof props.Type !== 'number')
        return false;
    return !EXCLUDED_TYPES.has(props.Type);
}

export function kindOf(type) {
    switch (type) {
    case Kind.MOUSE: return 'mouse';
    case Kind.KEYBOARD: return 'keyboard';
    case Kind.HEADSET:
    case Kind.HEADPHONES:
    case Kind.OTHER_AUDIO: return 'headset';
    case Kind.GAMING_INPUT: return 'gaming-input';
    default: return 'other';
    }
}

export {Kind, Level, State};

const LEVEL_NAMES = new Map([
    [Level.UNKNOWN, 'unknown'],
    [Level.DISCHARGING, 'normal'],
    [Level.LOW, 'low'],
    [Level.CRITICAL, 'critical'],
    [Level.ACTION, 'action'],
    [Level.NORMAL, 'normal'],
    [Level.HIGH, 'high'],
    [Level.FULL, 'full'],
]);

function nameOf(path, props) {
    if (typeof props.Model === 'string' && props.Model !== '')
        return props.Model;
    if (typeof props.Serial === 'string' && props.Serial !== '')
        return props.Serial;
    return path.split('/').pop();
}

export function normalize(path, props) {
    const coarse = props.BatteryLevel !== Level.NONE;
    let percent = null;
    if (!coarse && Number.isFinite(props.Percentage))
        percent = Math.round(props.Percentage);
    const level = coarse ? (LEVEL_NAMES.get(props.BatteryLevel) ?? 'unknown') : null;
    const state = typeof props.State === 'number' ? props.State : State.UNKNOWN;
    const charging = state === State.CHARGING || state === State.PENDING_CHARGE;
    const active = props.IsPresent !== false && level !== 'unknown';
    return {
        id: path,
        name: nameOf(path, props),
        kind: kindOf(props.Type),
        percent,
        level,
        state,
        charging,
        active,
        source: 'upower',
    };
}
