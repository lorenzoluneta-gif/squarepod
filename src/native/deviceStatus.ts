import { registerPlugin } from '@capacitor/core';

export interface BatteryStatus {
  percent: number;
  charging: boolean;
}

export interface DeviceStatusPlugin {
  getBattery(): Promise<BatteryStatus>;
}

export const DeviceStatus = registerPlugin<DeviceStatusPlugin>('DeviceStatus');
