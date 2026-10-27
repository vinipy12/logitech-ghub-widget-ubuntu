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
