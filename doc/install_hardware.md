# Install Guide - Hardware

## Shopping list

- [Raspberry Pi 5](https://www.raspberrypi.com/products/raspberry-pi-5/). The 2 GB model is enough.
- [Raspberry Pi Active Cooler](https://www.raspberrypi.com/products/active-cooler/). Its fan is controlled by the Pi's firmware; Desk-HUD only displays its speed.
- [Waveshare 11.9" HDMI LCD](https://www.waveshare.com/11.9inch-hdmi-lcd.htm), the 1480×320 touch screen. Its kit includes the HDMI and USB adapters used below.
- 32 GB microSD card
- USB-C power supply rated 5 V / 5 A (25 W or more), such as the official Raspberry Pi 27 W supply. The screen is powered through the Pi.
- A stand: the [3D printed stand](install_stand.md), or the original project's [wooden case](install_case.md)

Optional: an [HC-SR04 ultrasonic distance sensor](https://www.sparkfun.com/products/17777) to wake the screen when someone approaches. The code still includes a reader for it (`distance.py`), but my build has none fitted and the server simulates a constant reading instead, so the screen stays awake until you tap the sleep button.

## Assembly

1. Fit the Active Cooler to the Raspberry Pi 5.
2. Mount the Pi on the back of the screen with the screws and standoffs from the screen's kit.
3. Connect the screen's HDMI input to the Pi's HDMI 0 port (next to the USB-C power port) and its touch USB to one of the Pi's USB ports, using the kit's adapters.
4. Insert the microSD card prepared in the [software guide](install_software.md).
5. Put the screen in its stand.

![Touch screen back](img/lcd.jpg)

![Raspberry Pi on the screen](img/rpi.jpg)

(Photos from the original build, which used a Raspberry Pi 4 and a separate fan.)

Power up through the Pi's USB-C port. The panel is natively 320×1480 portrait, so until the software is set up (the [software guide](install_software.md#display-and-touch) rotates both the picture and the touch input), the picture appears sideways.

## Troubleshooting

### The screen is black
1. **Power supply:** make sure the Pi has a 5 A (25 W or more) supply.
2. **Screen power:** try the power button on the screen.
3. **Another screen:** connect the Pi to a different monitor to check that it boots.
4. **Power the screen directly:** connect the supply to the screen and the HDMI cable from the screen to the Pi.
5. **Cables:** swap the HDMI and USB cables for the ones from the screen's kit.

### Taps land in the wrong place
The touch input has to be rotated to match the display. See [Display and touch](install_software.md#display-and-touch).
