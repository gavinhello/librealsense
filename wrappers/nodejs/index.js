// Copyright (c) 2017 Intel Corporation. All rights reserved.
// Use of this source code is governed by an Apache 2.0 license
// that can be found in the LICENSE file.

'use strict';

const RS2 = require('bindings')('node_librealsense');
const EventEmitter = require('events');
const PNG = require('pngjs').PNG;
const fs = require('fs');

// TODO(tingshao): resolve the potential disabled eslint errors
/* eslint-disable prefer-rest-params, valid-jsdoc, no-unused-vars, camelcase */
/**
 * A RealSense camera
 */
class Device {
  constructor(dev) {
    this.cxxDev = dev;
    this._events = new EventEmitter();
  }

  /**
   * Check if everything is OK, e.g. if the device object is connected to underlying hardware
   * @return {Boolean}
   */
  isValid() {
    return (this.cxxDev !== null);
  }

  /**
   * get an array of adjacent sensors, sharing the same physical parent composite device
   * @return {Sensor[]}
   */
  querySensors() {
    let sensors = this.cxxDev.querySensors();
    if (!sensors) return undefined;

    const array = [];
    sensors.forEach((s) => {
      if (s.isDepthSensor()) {
        array.push(new DepthSensor(s));
      } else if (s.isROISensor()) {
        array.push(new ROISensor(s));
      } else {
        array.push(new Sensor(s));
      }
    });
    return array;
  }

  /**
   * Information that can be queried from the device.
   * Not all information attributes are available on all camera types.
   * This information is mainly available for camera debug and troubleshooting and should not be
   * used in applications.
   * @typedef {Object} CameraInfoObject
   * @property {String|undefined} name - Device friendly name. <br> undefined is not
   * supported.
   * @property {String|undefined} serialNumber - Device serial number. <br> undefined is not
   * supported.
   * @property {String|undefined} firmwareVersion - Primary firmware version.
   * <br> undefined is not supported.
   * @property {String|undefined} physicalPort - Unique identifier of the port the device is
   * connected to (platform specific). <br> undefined is not supported.
   * @property {String|undefined} debugOpCode - If device supports firmware logging, this is the
   * command to send to get logs from firmware. <br> undefined is not supported.
   * @property {String|undefined} advancedMode - True iff the device is in advanced mode.
   * <br> undefined is not supported.
   * @property {String|undefined} productId - Product ID as reported in the USB descriptor.
   * <br> undefined is not supported.
   * @property {Boolean|undefined} cameraLocked - True if EEPROM is locked. <br> undefined is not
   * supported.
   * @see [Device.getCameraInfo()]{@link Device#getCameraInfo}
   */

  /**
   * Get camera information
   * There are 2 acceptable forms of syntax:
   * <pre><code>
   *  Syntax 1. getCameraInfo()
   *  Syntax 2. getCameraInfo(info)
   * </code></pre>
   *
   * @param {String|Integer} [info] - the camera_info type, see {@link camera_info} for available
   * values
   * @return {CameraInfoObject} if no argument is provided, {CameraInfoObject} is returned.
   * If a camera_info is provided, the specific camera info value is returned.
   */
  getCameraInfo(info) {
    if (arguments.length === 0) {
      let result = {};
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_NAME)) {
        result.name = this.cxxDev.getCameraInfo(camera_info.CAMERA_INFO_NAME);
      }
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_SERIAL_NUMBER)) {
        result.serialNumber = this.cxxDev.getCameraInfo(camera_info.CAMERA_INFO_SERIAL_NUMBER);
      }
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_FIRMWARE_VERSION)) {
        result.firmwareVersion = this.cxxDev.getCameraInfo(
            camera_info.CAMERA_INFO_FIRMWARE_VERSION);
      }
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_PHYSICAL_PORT)) {
        result.physicalPort = this.cxxDev.getCameraInfo(camera_info.CAMERA_INFO_PHYSICAL_PORT);
      }
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_DEBUG_OP_CODE)) {
        result.debugOpCode = this.cxxDev.getCameraInfo(camera_info.CAMERA_INFO_DEBUG_OP_CODE);
      }
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_ADVANCED_MODE)) {
        result.advancedMode = this.cxxDev.getCameraInfo(camera_info.CAMERA_INFO_ADVANCED_MODE);
      }
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_PRODUCT_ID)) {
        result.productId = this.cxxDev.getCameraInfo(camera_info.CAMERA_INFO_PRODUCT_ID);
      }
      if (this.cxxDev.supportsCameraInfo(camera_info.CAMERA_INFO_CAMERA_LOCKED)) {
        result.cameraLocked = this.cxxDev.getCameraInfo(camera_info.CAMERA_INFO_CAMERA_LOCKED);
      }
      return result;
    } else {
      let info = checkStringNumber(arguments[0],
          constants.camera_info.CAMERA_INFO_NAME,
          constants.camera_info.CAMERA_INFO_COUNT,
          cameraInfo2Int,
          'Device.getCameraInfo(info) expects a number or string as the 1st argument',
          'Device.getCameraInfo(info) expects a valid value as the 1st argument');
      return this.cxxDev.getCameraInfo(info);
    }
  }

  get cameraInfo() {
    return this.getCameraInfo();
  }

  /**
   * Check if specific camera info is supported.
   * @param {String|Integer} info - info type to query. See {@link camera_info} for available values
   * @return {Boolean|undefined} Returns undefined if an invalid info type was specified.
   * @see enum {@link camera_info}
   * @example <caption>Example of 3 equivalent calls of the same query</caption>
   * device.supportsCameraInfo('name');
   * device.supportsCameraInfo(realsense2.camera_info.camera_info_name);
   * device.supportsCameraInfo(realsense2.camera_info.CAMERA_INFO_NAME);
   */
  supportsCameraInfo(info) {
    if (arguments.length !== 1) {
      throw new TypeError('Device.supportsCameraInfo(info) expects 1 argument');
    }

    let i = checkStringNumber(arguments[0],
        constants.camera_info.CAMERA_INFO_NAME, constants.camera_info.CAMERA_INFO_COUNT,
        cameraInfo2Int,
        'Device.supportsCameraInfo(info) expects a number or string as the 1st argument',
        'Device.supportsCameraInfo(info) expects a valid value as the 1st argument');
    return this.cxxDev.supportsCameraInfo(i);
  }

  /**
   * Send hardware reset request to the device.
   * @return {undefined}
   */
  reset() {
    this.cxxDev.reset();
  }

  /**
   * Release resources associated with the object
   */
  destroy() {
    this.cxxDev.destroy();
    this.cxxDev = undefined;
    this._events = undefined;
  }
}

/**
 * Class represents a stream configuration
 */
class StreamProfile {
  constructor(cxxProfile) {
    this.cxxProfile = cxxProfile;
    this.streamValue = this.cxxProfile.stream();
    this.formatValue = this.cxxProfile.format();
    this.fpsValue = this.cxxProfile.fps();
    this.indexValue = this.cxxProfile.index();
    this.uidValue = this.cxxProfile.uniqueID();
    this.isDefaultValue = this.cxxProfile.isDefault();
  }

  /**
   * Get stream index the input profile in case there are multiple streams of the same type
   *
   * @return {Integer}
   */
  get streamIndex() {
    return this.indexValue;
  }

  /**
   * Get stream type
   *
   * @return {Integer}
   */
  get streamType() {
    return this.streamValue;
  }

  /**
   * Get binary data format
   *
   * @return {Integer}
   */
  get format() {
    return this.formatValue;
  }

  /**
   * Expected rate for data frames to arrive, meaning expected number of frames per second
   *
   * @return {Integer}
   */
  get fps() {
    return this.fpsValue;
  }

  /**
   * Get the identifier for the stream profile, unique within the application
   *
   * @return {Integer}
   */
  get uniqueID() {
    return this.uidValue;
  }

  /**
   * Returns non-zero if selected profile is recommended for the sensor
   * This is an optional hint we offer to suggest profiles with best performance-quality tradeof
   *
   * @return {Boolean}
   */
  get isDefault() {
    return this.isDefaultValue;
  }

  /**
   * Extrinsics:
   * @typedef {Object} ExtrinsicsObject
   * @property {Float32[]} rotation - Array(9), Column-major 3x3 rotation matrix
   * @property {Float32[]} translation - Array(3), Three-element translation vector, in meters
   * @see [StreamProfile.getExtrinsicsTo()]{@link StreamProfile#getExtrinsicsTo}
   */

  /**
   * Get extrinsics from a this stream to the target stream
   *
   * @param {StreamProfile} toProfile the target stream profile
   * @return {ExtrinsicsObject}
   */
  getExtrinsicsTo(toProfile) {
    return this.cxxProfile.getExtrinsicsTo(toProfile.cxxProfile);
  }

  destroy() {
    if (this.cxxProfile) this.cxxProfile.destroy();
    this.cxxProfile = undefined;
  }
}

/**
 * List of devices
 */
class DeviceList {
  constructor(cxxList) {
    this.cxxList = cxxList;
  }

  /**
   * Release resources associated with the object
   */
  destroy() {
    this.cxxList.destroy();
    this.cxxList = undefined;
  }

  /**
   * Checks if a specific device is contained inside a device list.
   *
   * @param {Device} device the camera to be checked
   * @return {Boolean} true if the camera is contained in the list, otherwise false
   */
  contains(device) {
    if (!(device instanceof Device)) {
      throw new TypeError('DeviceList.contains expects a Device object as the argument!');
    }
    return this.cxxList.contains(device.cxxDev);
  }

  /**
   * Creates a device by index. The device object represents a physical camera and provides the
   * means to manipulate it.
   *
   * @param {Integer} index the zero based index of the device in the device list
   * @return {Device|undefined}
   */
  getDevice(index) {
    let dev = this.cxxList.getDevice(index);
    return dev ? new Device(dev) : undefined;
  }

  get devices() {
    let len = this.cxxList.size();
    if (!len) {
      return undefined;
    }
    let output = [];
    for (let i = 0; i < len; i++) {
      output[i] = new Device(this.cxxList.getDevice(i));
    }
    return output;
  }
  /**
   * Determines number of devices in a list.
   * @return {Integer}
   */
  get size() {
    return this.cxxList.size();
  }
}

class VideoStreamProfile extends StreamProfile {
  /**
   * Construct a device object, representing a RealSense camera
   */
  constructor(cxxProfile) {
    super(cxxProfile);

    // TODO(tinshao): determine right width and height value
    this.widthValue = this.cxxProfile.width();
    this.heightValue = this.cxxProfile.height();
  }

  /**
   * Width in pixels of the video stream
   *
   * @return {Integer}
   */
  get width() {
    return this.widthValue;
  }


  /**
   * height in pixels of the video stream
   *
   * @return {Integer}
   */
  get height() {
    return this.heightValue;
  }

  /**
   * Stream intrinsics:
   * @typedef {Object} IntrinsicsObject
   * @property {Integer} width - Width of the image in pixels
   * @property {Integer} height - Height of the image in pixels
   * @property {Float32} ppx - Horizontal coordinate of the principal point of the image, as a
   * pixel offset from the left edge
   * @property {Float32} ppy - Vertical coordinate of the principal point of the image, as a pixel
   * offset from the top edge
   * @property {Float32} fx - Focal length of the image plane, as a multiple of pixel width
   * @property {Float32} fy - Focal length of the image plane, as a multiple of pixel height
   * @property {Integer} model - Distortion model of the image, see
   * @property {Float32[]} coeffs - Array(5), Distortion coefficients
   * @see [StreamProfile.getIntrinsics()]{@link StreamProfile#getIntrinsics}
   */

  /**
   * When called on a VideoStreamProfile, returns the intrinsics of specific stream configuration
   * @return {IntrinsicsObject}
   */
  getIntrinsics() {
    return this.cxxProfile.getVideoStreamIntrinsics();
  }
}

class Options {
  constructor(cxxObj) {
    this.cxxObj = cxxObj;
  }
  /**
  * Check if particular option is read-only
  * @param {String|Number} option The option to be checked
  * @return {Boolean|undefined} true if option is read-only and undefined if not supported
  */
  isOptionReadOnly(option) {
    let o = checkStringNumber(arguments[0],
        constants.option.OPTION_BACKLIGHT_COMPENSATION, constants.option.OPTION_COUNT,
        option2Int,
        'Sensor.isOptionReadOnly(option) expects a number or string as the 1st argument',
        'Sensor.isOptionReadOnly(option) expects a valid value as the 1st argument');
    if (!this.cxxObj.supportsOption(o)) return undefined;

    return this.cxxObj.isOptionReadonly(o);
  }

  /**
   * Read option value from the sensor.
   * @param {String|Number} option  The option to be queried
   * @return {Float32|undefined} The value of the option, or <code>undefined</code> if invalid
   * option
   * @see {@link option}
   */
  getOption(option) {
    let o = checkStringNumber(arguments[0],
        constants.option.OPTION_BACKLIGHT_COMPENSATION, constants.option.OPTION_COUNT,
        option2Int,
        'Sensor.getOption(option) expects a number or string as the 1st argument',
        'Sensor.getOption(option) expects a valid value as the 1st argument');
    if (!this.cxxObj.supportsOption(o)) return undefined;

    return this.cxxObj.getOption(o);
  }

  /**
   * @typedef {Object} OptionRangeObject
   * @property {Float32} minValue - the minimum value which will be accepted for this option
   * @property {Float32} maxValue - the maximum value which will be accepted for this option
   * @property {Float32} defaultValue - the default value of the option
   * @property {Float32} step - the granularity of options which accept discrete values, or zero if
   * the option accepts continuous values
   * @see [Sensor.getOptionRange()]{@link Sensor#getOptionRange}
   */

  /**
   * Retrieve the available range of values of a supported option.
   * @param {String|Integer} option - the option that is being queried. See {@link option} for
   * available values
   * @return {OptionRangeObject|undefined} Returns undefined if an invalid option was specified
   * @see {@link OptionRangeObject}
   * @see {@link option}
   *
   * @example <caption>Example of 3 equivalent calls of the same option range</caption>
   * Sensor.getOptionRange('backlight-compensation');
   * Sensor.getOptionRange(realsense2.option.option_backlight_compensation);
   * Sensor.getOptionRange(realsense2.option.OPTION_BACKLIGHT_COMPENSATION);
   */
  getOptionRange(option) {
    let o = checkStringNumber(arguments[0],
        constants.option.OPTION_BACKLIGHT_COMPENSATION, constants.option.OPTION_COUNT,
        option2Int,
        'Sensor.getOptionRange(option) expects a number or string as the 1st argument',
        'Sensor.getOptionRange(option) expects a valid value as the 1st argument');
    if (!this.cxxObj.supportsOption(o)) return undefined;

    return this.cxxObj.getOptionRange(o);
  }

  /**
   * Write new value to device option.
   * @param {String|Integer} option - the option that is being queried. See {@link option} for
   * available values
   * @param {Float32} value - the new value to be set
   * @see {@link option}
   * @return {undefined}
   */
  setOption(option, value) {
    let o = checkStringNumber(arguments[0],
        constants.option.OPTION_BACKLIGHT_COMPENSATION, constants.option.OPTION_COUNT,
        option2Int,
        'Sensor.getOptionRange(option) expects a number or string as the 1st argument',
        'Sensor.getOptionRange(option) expects a valid value as the 1st argument');
    if (!this.cxxObj.supportsOption(o) || this.cxxObj.isOptionReadonly(o)) return undefined;

    this.cxxObj.setOption(o, value);
  }

  /**
   * Check if particular option is supported by a subdevice.
   * @param {String|Integer} option - the option that is being queried. See {@link option} for
   * available values
   * @return {Boolean|undefined} Returns undefined if an invalid option was specified
   * @see {@link option}
   */
  supportsOption(option) {
    let o = checkStringNumber(arguments[0],
        constants.option.OPTION_BACKLIGHT_COMPENSATION, constants.option.OPTION_COUNT,
        option2Int,
        'Sensor.supportsOption(option) expects a number or string as the 1st argument',
        'Sensor.supportsOption(option) expects a valid value as the 1st argument');
    return this.cxxObj.supportsOption(o);
  }

  /**
   * Get option description.
   * @param {String|Integer} option - the option that is being queried. See {@link option} for
   * available values
   * @return {String|undefined} the human readable description of the option. Returns undefined if
   * an invalid option was specified
   * @see {@link option}
   */
  getOptionDescription(option) {
    let o = checkStringNumber(arguments[0],
        constants.option.OPTION_BACKLIGHT_COMPENSATION, constants.option.OPTION_COUNT,
        option2Int,
        'Sensor.supportsOption(option) expects a number or string as the 1st argument',
        'Sensor.supportsOption(option) expects a valid value as the 1st argument');
    if (!this.cxxObj.supportsOption(o)) return undefined;
    return this.cxxObj.getOptionDescription(o);
  }

  /**
   * Get option value description (in case specific option value hold special meaning).
   * @param {String|Integer} option - the option that is being queried. See {@link option} for
   * available values
   * @return {String|undefined} the human readable description of the option value. Returns
   * undefined if an invalid option was specified
   * @see {@link option}
   */
  getOptionValueDescription(option, value) {
    let o = checkStringNumber(arguments[0],
        constants.option.OPTION_BACKLIGHT_COMPENSATION, constants.option.OPTION_COUNT,
        option2Int,
        'Sensor.supportsOption(option) expects a number or string as the 1st argument',
        'Sensor.supportsOption(option) expects a valid value as the 1st argument');
    if (!this.cxxObj.supportsOption(o)) return undefined;

    return this.cxxObj.getOptionValueDescription(o, value);
  }
}

/**
 * A sensor device in a RealSense camera
 */
class Sensor extends Options {
  /**
   * Construct a Sensor object, representing a RealSense camera subdevice
   */
  constructor(sensor) {
    super(sensor);
    this.cxxSensor = sensor;
    this._events = new EventEmitter();
  }

  /**
   * Check if everything is OK, e.g. if the device object is connected to underlying hardware
   * @return {Boolean}
   */
  isValid() {
    return (this.cxxSensor !== null);
  }

  /**
   * Open subdevice for exclusive access, by committing to a configuration.
   *  There are 2 acceptable forms of syntax:
   * <pre><code>
   *  Syntax 1. open(streamProfile)
   *  Syntax 2. open(profileArray)
   * </code></pre>
   *  Syntax 2 is for opening multiple profiles in one function call
   *
   * @param {StreamProfile} streamProfile configuration commited by the device
   * @param {StreamProfile[]} profileArray configurations array commited by the device
   * @see [Sensor.getStreamProfiles]{@link Sensor#getStreamProfiles} for a list of all supported
   * stream profiles
   */
  open(streamProfile) {
    if (arguments.length != 1) {
      throw new TypeError(
          'Sensor.open() expects a streamProfile object or an array of streamProfile objects');
    }
    if (Array.isArray(streamProfile) && streamProfile.length > 0) {
      for (let i = 0; i < streamProfile.length; i++) {
        if (!(streamProfile[i] instanceof StreamProfile)) {
          throw new TypeError(
              'Sensor.open() expects a streamProfile object or an array of streamProfile objects'); // eslint-disable-line
        }
      }
      this.cxxSensor.openMultipleStream(streamProfile);
    } else {
      if (!(streamProfile instanceof StreamProfile)) {
        throw new TypeError(
            'Sensor.open() expects a streamProfile object or an array of streamProfile objects'); // eslint-disable-line
      }
      this.cxxSensor.openStream(streamProfile.cxxProfile);
    }
  }

  /**
  * Stops any streaming and close subdevice.
  * @return {undefined} No return value
  */
  close() {
    this.cxxSensor.close();
  }

  /**
  * Delete the resource for accessing the subdevice. The device would not be accessable from
  * this object after the operation.
  * @return {undefined} No return value
  */
  destroy() {
    this.events_ = null;
    this.cxxSensor.destroy();
    this.cxxSensor = undefined;
  }

  /**
   * This callback is called when a frame is captured
   * @callback FrameCallback
   * @param {Frame} frame - The captured frame
   *
   * @see [Sensor.start]{@link Sensor#start}
   */

  /**
   * Start passing frames into user provided callback
   * There are 2 acceptable syntax:
   * <pre><code>
   *  Syntax 1. start(callback)
   *  Syntax 2. start(Syncer)
   * </code></pre>
   *
   * @param {FrameCallback} callback
   * @param {Syncer} syncer, the syncer to synchronize frames
   *
   * @example <caption>Simply do logging when a frame is captured</caption>
   *  sensor.start((frame) => {
   *    console.log(frame.timestamp, frame.frameNumber, frame.data);
   *  });
   *
   */
  start(callback) {
    if (arguments.length != 1) {
      throw new TypeError('Sensor.start expects 1 argument');
    }
    if (arguments[0] instanceof Syncer) {
      this.cxxSensor.startWithSyncer(arguments[0].cxxSyncer, false, 0);
    } else {
      // create object to hold frames generated from native.
      this.frame = new Frame();
      this.depthFrame = new DepthFrame();
      this.videoFrame = new VideoFrame();

      let inst = this;
      this.cxxSensor.frameCallback = function() {
        // When the callback is triggered, the underlying frame bas been saved in the objects
        // created above, we need to update it and callback.
        if (inst.depthFrame.isValid) {
          inst.depthFrame.updateProfile();
          callback(inst.depthFrame);
        } else if (inst.videoFrame.isValid) {
          inst.videoFrame.updateProfile();
          callback(inst.videoFrame);
        } else {
          inst.frame.updateProfile();
          callback(inst.frame);
        }
      };
      this.cxxSensor.startWithCallback('frameCallback', this.frame.cxxFrame,
          this.depthFrame.cxxFrame, this.videoFrame.cxxFrame);
    }
  }

  /**
   * stop streaming
   * @return {undefined} No return value
   */
  stop() {
    this.cxxSensor.stop();
    if (this.frame) this.frame.release();
    if (this.videoFrame) this.videoFrame.release();
    if (this.depthFrame) this.depthFrame.release();
  }

  /**
   * @typedef {Object} NotificationEventObject
   * @property {String} descr - The human readable literal description of the notification
   * @property {Float}  timestamp - The timestamp of the notification
   * @property {String} severity - The severity of the notification
   * @property {String} category - The category of the notification
   */

  /**
   * This callback is called when there is a device notification
   * @callback NotificationCallback
   * @param {NotificationEventObject} info
   * @param {String} info.descr - See {@link NotificationEventObject} for details
   * @param {Float}  info.timestamp - See {@link NotificationEventObject} for details
   * @param {String} info.severity - See {@link NotificationEventObject} for details
   * @param {String} info.category - See {@link NotificationEventObject} for details
   *
   * @see {@link NotificationEventObject}
   * @see [Sensor.setNotificationsCallback()]{@link Sensor#setNotificationsCallback}
   */

  /**
   * @event Sensor#notification
   * @param {NotificationEventObject} evt
   * @param {String} evt.descr - See {@link NotificationEventObject} for details
   * @param {Float}  evt.timestamp - See {@link NotificationEventObject} for details
   * @param {String} evt.severity - See {@link NotificationEventObject} for details
   * @param {String} evt.category - See {@link NotificationEventObject} for details
   * @see {@link NotificationEventObject}
   * @see [Sensor.setNotificationsCallback()]{@link Sensor#setNotificationsCallback}
   */

  /**
   * register notifications callback
   * @param {NotificationCallback} callback The user-provied notifications callback
   * @see {@link NotificationEventObject}
   * @see [Sensor 'notification']{@link Sensor#event:notification} event
   * @return {undefined}
   */
  setNotificationsCallback(callback) {
    if (!callback) return undefined;

    this._events.on('notification', (info) => {
      callback(info);
    });
    let inst = this;
    if (!this.cxxSensor.notificationCallback) {
      this.cxxSensor.notificationCallback = function(info) {
        inst._events.emit('notification', info);
      };
      this.cxxSensor.setNotificationCallback('notificationCallback');
    }
    return undefined;
  }

  /**
   * Get a list of stream profiles that given subdevice can provide. The returned profiles should be
   * destroyed by calling its destroy() method.
   *
   * @return {StreamProfile[]} all of the supported stream profiles
   * See {@link StreamProfile}
   */
  getStreamProfiles() {
    let profiles = this.cxxSensor.getStreamProfiles();
    if (profiles) {
      const array = [];
      profiles.forEach((profile) => {
        if (profile.isVideoProfile()) {
          array.push(new VideoStreamProfile(profile));
        } else {
          array.push(new StreamProfile(profile));
        }
      });
      return array;
    }
  }

  /**
   * Motion Sensor intrinsics: scale, bias, and variances.
   * @typedef {Object} MotionIntrinsics
   * @property {Float32[]} data - Array(12), Interpret data array values. Indices are:
   *   <br>[0 - Scale X, 1 - cross axis, 2 - cross axis, 3 - Bias X,
   *   <br> 4 - cross axis, 5 - Scale Y, 6 - cross axis, 7 - Bias Y,
   *   <br> 8 - cross axis, 9 - cross axis, 10 - Scale Z, 11 - Bias Z]
   * @property {Float32[]} noiseVariances - Array(3), Variance of noise for X, Y, and Z axis
   * @property {Float32[]} biasVariances - Array(3), Variance of bias for X, Y, and Z axis
   * @see [Sensor.getMotionIntrinsics()]{@link Sensor#getMotionIntrinsics}
   */

  /**
   * Returns scale and bias of a motion stream.
   * @param {String|Integer} stream - type of stream, see [enum stream]{@link stream} for available
   * stream value
   * @return {MotionIntrinsics} {@link MotionIntrinsics}
   */
  getMotionIntrinsics(stream) {
    let s = checkStringNumber(stream,
        constants.stream.STREAM_ANY, constants.stream.STREAM_COUNT,
        stream2Int,
        'Sensor.getMotionIntrinsics() expects a number or string to specify the stream',
        'Sensor.getMotionIntrinsics() expects a valid value to specify the stream');
    return this.cxxSensor.getMotionIntrinsics(s);
  }
}

/**
 * Sensor for managing region of interest.
 */
class ROISensor extends Sensor {
  /**
   * Construct a ROISensor object, representing a RealSense camera subdevice
   *
   */
   constructor(sensor) {
    super(sensor);
  }

  /**
   * @typedef {Object} RegionOfInterestObject
   * @property {Float32} minX - lower horizontal bound in pixels
   * @property {Float32} minY - lower vertical bound in pixels
   * @property {Float32} maxX - upper horizontal bound in pixels
   * @property {Float32} maxY - upper vertical bound in pixels
   * @see [Device.getRegionOfInterest()]{@link Device#getRegionOfInterest}
   */

  /**
   * Get the active region of interest to be used by auto-exposure algorithm.
   * @return {RegionOfInterestObject|undefined} Returns undefined if failed
   * @see {@link RegionOfInterestObject}
   */
  getRegionOfInterest() {
    return this.cxxSensor.getRegionOfInterest();
  }

  /**
   * Set the active region of interest to be used by auto-exposure algorithm
   * There are 2 acceptable forms of syntax:
   * <pre><code>
   *  Syntax 1. setRegionOfInterest(region)
   *  Syntax 2. setRegionOfInterest(minX, minY, maxX, maxY)
   * </code></pre>
   *
   * @param {RegionOfInterestObject} region - the region of interest to be used.
   * @param {Float32} region.minX - see {@link RegionOfInterestObject} for details.
   * @param {Float32} region.minY - see {@link RegionOfInterestObject} for details.
   * @param {Float32} region.maxX - see {@link RegionOfInterestObject} for details.
   * @param {Float32} region.maxY - see {@link RegionOfInterestObject} for details.
   *
   * @param {Float32} minX - see {@link RegionOfInterestObject} for details.
   * @param {Float32} minY - see {@link RegionOfInterestObject} for details.
   * @param {Float32} maxX - see {@link RegionOfInterestObject} for details.
   * @param {Float32} maxY - see {@link RegionOfInterestObject} for details.
   */
  setRegionOfInterest(region) {
    let minX;
    let minY;
    let maxX;
    let maxY;
    if (arguments.length === 1 && typeof region === 'object') {
      minX = region.minX;
      minY = region.minY;
      maxX = region.maxX;
      maxY = region.maxY;
    } else if (arguments.length >= 4) {
      minX = arguments[0];
      minY = arguments[1];
      maxX = arguments[2];
      maxY = arguments[3];
      this.cxxSensor.setRegionOfInterest(minX, minY, maxX, maxY);
    } else {
      throw new TypeError(
          'setRegionOfInterest(region) expects a RegionOfInterestObject as argument');
    }
  }
}

/**
 * Depth sensor
 */
class DepthSensor extends Sensor {
  /**
   * Construct a device object, representing a RealSense camera
   */
  constructor(sensor) {
    super(sensor);
  }

  /**
   * Retrieves mapping between the units of the depth image and meters.
   *
   * @return {Float} depth in meters corresponding to a depth value of 1
   */
  get depthScale() {
    return this.cxxSensor.getDepthScale();
  }
}

const internal = {
  ctx: [],

  addContext: function(c) {
    this.ctx.push(c);
  },

  cleanup: function() {
    this.ctx.forEach((context) => {
      context.destroy();
    });
    this.ctx = [];
  },

  cleanupContext: function() {
    let newArray = [];
    this.ctx.forEach((c) => {
      if (c.cxxCtx) {
        newArray.push(c);
      }
    });
    // Dropping reference to invalid context(s)
    this.ctx = newArray;
  },
};

/**
 * Default librealsense context class,
 */
class Context {
  constructor(cxxCtx) {
    this._events = new EventEmitter();
    if (arguments.length === 1 && arguments[0] === 'no-cxx-context') {
      // Subclass will do the cxxCtx
    } else {
      if (arguments.length === 0) {
        this.cxxCtx = new RS2.RSContext();
        this.cxxCtx.create();
      } else {
        this.cxxCtx = cxxCtx;
      }

      this.cxxCtx._events = this._events;
    }

    internal.addContext(this);
  }

  /**
   * Cleanup underlying C++ context, and release all resources that were created by this context.
   * The JavaScript Context object(s) will not be garbage-collected without call(s) to this function
   */
  destroy() {
    this.cxxCtx.destroy();
    this.cxxCtx = undefined;
    internal.cleanupContext();
  }

  /**
   * Get the events object of EventEmitter
   * @return {EventEmitter}
   */
  get events() {
    return this._events;
  }

  /**
  * Create a static snapshot of all connected devices at the time of the call
  * @return {DeviceList|undefined} connected devices at the time of the call
  */
  queryDevices() {
    let list = this.cxxCtx.queryDevices();
    return (list ? new DeviceList(list) : undefined);
  }

  /**
  * Generate an array of all available sensors from all RealSense devices
  * @return {Sensor[]|undefined}
  */
  querySensors() {
    let devList = this.queryDevices();
    if (!devList) {
      return undefined;
    }
    let devices = devList.devices;
    if (devices && devices.length) {
      const array = [];
      devices.forEach((dev) => {
        const sensors = dev.querySensors();
        sensors.forEach((sensor) => {
          array.push(sensor);
        });
      });
      return array;
    }
    return undefined;
  }

  /**
   * Get the device from one of its sensors
   *
   * @param {Sensor} sensor
   * @return {Device|undefined}
   */
  getSensorParent(sensor) {
    let cxxDev = this.cxxCtx.createDeviceFromSensor(sensor.cxxSensor);
    if (!cxxDev) {
      return undefined;
    }
    return new Device(cxxDev);
  }

  /**
   * When one or more devices are plugged or unplugged into the system
   * @event Context#device-changed
   * @param {DeviceList} removed - The devices removed from the system
   * @param {DeviceList} added - The devices added to the system
   */

  /**
   * This callback is called when number of devices is changed
   * @callback devicesChangedCallback
   * @param {DeviceList} removed - The devices removed from the system
   * @param {DeviceList} added - The devices added to the system
   *
   * @see [Context.setDevicesChangedCallback]{@link Context#setDevicesChangedCallback}
   */

  /**
   * Register a callback function to receive device-changed notification
   * @param {devicesChangedCallback} callback - devices changed callback
   */
  setDevicesChangedCallback(callback) {
    if (!callback) return;

    this._events.on('device-changed', (removed, added) => {
      callback(removed, added);
    });
    let inst = this;
    if (!this.cxxCtx.deviceChangedCallback) {
      this.cxxCtx.deviceChangedCallback = function(removed, added) {
        let rmList = (removed ? new DeviceList(removed) : undefined);
        let addList = (added ? new DeviceList(added) : undefined);
        inst._events.emit('device-changed', rmList, addList);
      };
      this.cxxCtx.setDevicesChangedCallback('deviceChangedCallback');
    }
  }

  /**
   * Create a PlaybackDevice to playback recored data file.
   *
   * @param {String} file - the file path
   * @return {PlaybackDevice}
   */
  loadDevice(file) {
    return new PlaybackDevice(this.cxxCtx.loadDeviceFile(file));
  }

  /**
   * Removes a PlaybackDevice from the context, if exists
   *
   * @param {String} file The file name that was loaded to create the playback device
   */
  unloadDevice(file) {
    // TODO (Shaoting) support this method
  }
}

/**
 * Record camera data to a disk file
 * @extends Context
 */
class RecordContext extends Context {
  /**
   * @param {String} fileName The file name of the recording data
   * @param {String} section The section name to record
   * @param {String|Integer} mode Recording mode, default to 'best-quality'
   *
   * @see [enum recording_mode]{@link recording_mode}
   */
  constructor(fileName, section, mode = 'best-quality') {
    super('no-cxx-context');
    // TODO: create this.cxxCtx in child class
    // this.cxxCtx = ...
    this.cxxCtx._events = this._events;
  }
}

/**
 * Playback camera recordings
 * @extends Context
 */
class PlaybackContext extends Context {
  /**
   * @param {String} fileName The file name of the recording
   * @param {String} section The section name used in recording
   */
  constructor(fileName = '', section = '') {
    super('no-cxx-context');
    // TODO: create this.cxxCtx in child class
    // this.cxxCtx = ...
    this.cxxCtx._events = this._events;
  }
}

class RecordDevice extends Device {
  constructor(file, cxxDevice) {
    super(cxxDevice);
    this.file = file;
  }
}

class PlaybackDevice extends Device {
  constructor(file, cxxDevice) {
    super(cxxDevice);
    this.file = file;
  }
}

/**
 * PointCloud accepts depth frames and outputs Points frames
 * In addition, given non-depth frame, the block will align texture coordinate to the non-depth
 * stream
 */
class PointCloud {
  constructor() {
    this.cxxPointCloud = new RS2.RSPointCloud();
    this.pointsFrame = new Points();
  }

  /**
   * Calculate to get a frame of type {@link Points}, from the data of specified DepthFrame
   * @param {DepthFrame} depthFrame the depth frame
   * @return {Points|undefined}
   */
  calculate(depthFrame) {
    if (arguments.length === 1 && depthFrame && depthFrame instanceof DepthFrame) {
      this.pointsFrame.release();
      if (this.cxxPointCloud.calculate(depthFrame.cxxFrame, this.pointsFrame.cxxFrame)) {
        return this.pointsFrame;
      }
      return undefined;
    }
    throw new TypeError('PointCloud.calculate() expects a frame argument.');
  }

  /**
   * Align texture coordinate to the mappedFrame
   * @param {Frame} mappedFrame the frame being mapped to
   * @return {undefined}
   */
  mapTo(mappedFrame) {
    if (mappedFrame) {
      this.cxxPointCloud.mapTo(mappedFrame.cxxFrame);
    } else {
      throw new TypeError('PointCloud.mapTo() expects a frame argument');
    }
  }

  release() {
    if (this.cxxPointCloud) this.cxxPointCloud.destroy();
    if (this.pointsFrame) this.pointsFrame.destroy();
  }

  /**
   * Destroy all resources associated with the object
   */
  destroy() {
    this.release();
    this.cxxPointCloud = undefined;
    this.pointsFrame = undefined;
  }
}

/**
 * The Colorizer can be used to quickly visualize the depth data by tranform data into RGB8 format
 */
class Colorizer {
  constructor() {
    this.cxxColorizer = new RS2.RSColorizer();
    this.cxxColorizer.create();
    this.depthRGB = new VideoFrame();
  }

  release() {
    if (this.cxxColorizer) this.cxxColorizer.destroy();
    if (this.depthRGB) this.depthRGB.destroy();
  }

  /**
   * Destroy all resources associated with the colorizer
   */
  destroy() {
    this.release();
    this.cxxColorizer = undefined;
    this.depthRGB = undefined;
  }

  get colorizedFrame() {
    return this.depthRGB;
  }

  /**
   * Tranform depth data into RGB8 format
   *
   * @param {DepthFrame} depthFrame the depth frame
   * @return {VideoFrame|undefined}
   */
  colorize(depthFrame) {
    if (arguments.length === 1 && depthFrame instanceof DepthFrame) {
      const success = this.cxxColorizer.colorize(depthFrame.cxxFrame, this.depthRGB.cxxFrame);
      this.depthRGB.updateProfile();
      return success ? this.depthRGB : undefined;
    } else {
      throw new TypeError('Colorizer.colorize() expects a frame argument');
    }
  }
}

/**
 * The Align allows to perform aliment of depth frames to other frames
 */
class Align {
  constructor(stream) {
    let s = checkStringNumber(stream,
            constants.stream.STREAM_ANY, constants.stream.STREAM_COUNT,
            stream2Int,
            'Align constructor expects a string or an integer argument',
            'Align constructor\'s argument value is invalid');

    this.cxxAlign = new RS2.RSAlign(s);
    this.frameSet = new FrameSet();
  }

  process(frameSet) {
    if (arguments.length === 1 && frameSet) {
      this.frameSet.release(); // Destroy all attached-frames (depth/color/etc.)
      if (this.cxxAlign.process(frameSet.cxxFrameSet, this.frameSet.cxxFrameSet)) {
        this.frameSet.__update();
        return this.frameSet;
      }
      return undefined;
    }

    throw new TypeError('Align.process() expects a frameset argument');
  }

  release() {
    if (this.cxxAlign) this.cxxAlign.destroy();
    if (this.frameSet) this.frameSet.destroy();
  }

  /**
   * Destroy resources associated with the object
   */
  destroy() {
    this.release();
    this.cxxAlign = undefined;
    this.frameSet = undefined;
  }
}

/**
 * This class resprents a picture frame
 *
 * @property {Boolean} isValid - True if the frame is valid, otherwise false.
 * @property {Uint16Array|Uint8Array} data - A typed array representing the data.
 *  <br>The type of the typed array depends on the <code>format</code> specified in camera
 * configuration.
 * @property {Integer} width - The width of the frame.
 * @property {Integer} height - The height of the frame.
 * @property {Integer|Int64} frameNumber - An integer or an object representing the frame number.
 *  <br>If the frame number is less than 2^53, then the return value is an integer number;
 *  <br>Otherwise it will be an <code>Int64</code> object defined in npm module "node-int64"
 * @property {Number} timestamp - The timestamp of the frame.
 * @property {Integer} streamType - The stream type of the frame.
 * see <code>enum {@link stream}</code>
 * @property {Integer} dataByteLength - Get the byte length of the buffer data.
 * @property {Integer} strideInBytes - The stride of the frame. The unit is number of bytes.
 * @property {Integer} bitsPerPixel - The number of bits per pixel
 * @property {string} timestampDomain - Get the domain (clock name) of timestamp value.
 *
 */
class Frame {
  constructor(cxxFrame) {
    this.cxxFrame = cxxFrame || new RS2.RSFrame();
    this.updateProfile();
  }

  updateProfile() {
    this.streamProfile = undefined;
    if (this.cxxFrame) {
      let cxxProfile = this.cxxFrame.getStreamProfile();
      if (cxxProfile) {
        this.streamProfile = cxxProfile.isVideoProfile ?
            new VideoStreamProfile(cxxProfile) : new StreamProfile(cxxProfile);
      }
    }
  }

  release() {
    if (this.cxxFrame) this.cxxFrame.destroy();
    if (this.streamProfile) this.streamProfile.destroy();
    this.arrayBuffer = undefined;
    this.typedArray = undefined;
  }

  /**
   * Destroy the frame and its resource
   */
  destroy() {
    this.release();
    this.cxxFrame = undefined;
    this.StreamProfile = undefined;
  }

  /**
   * Retrieve pixel format of the frame
   * @return {Integer} see enum {@link format} for available values
   */
  get format() {
    return this.streamProfile.format;
  }

  /**
   * Retrieve the origin stream type that produced the frame
   * @return {Integer} see {@link stream} for avaiable values
   */
  get streamType() {
    return this.streamProfile.stream;
  }

  get profile() {
    return this.streamProfile;
  }

  get width() {
    return this.streamProfile.width ? this.streamProfile.width : this.cxxFrame.getWidth();
  }

  get height() {
    return this.streamProfile.height ? this.streamProfile.height : this.cxxFrame.getHeight();
  }

  /**
   * Check if the frame is valid
   * @return {Boolean}
   */
  get isValid() {
    return (this.cxxFrame && this.cxxFrame.isValid());
  }

  /**
   * Retrieve timestamp from the frame in milliseconds
   * @return {Integer}
   */
  get timestamp() {
    return this.cxxFrame.getTimestamp();
  }

  /**
   * Retrieve timestamp domain. timestamps can only be comparable if they are in common domain
   * (for example, depth timestamp might come from system time while color timestamp might come
   * from the device)
   * this method is used to check if two timestamp values are comparable (generated from the same
   * clock)
   * @return {Integer} see {@link timestamp_domain} for avaiable values
   */
  get timestampDomain() {
    return this.cxxFrame.getTimestampDomain();
  }

  /**
   * Retrieve the current value of a single frame metadata
   * @param {String|Number} metadata the type of metadata, see {@link frame_metadata} for avaiable
   * values
   * @return {Uint8Array} The metadata value, 8 bytes, byte order is bigendian.
   */
  frameMetadata(metadata) {
    let m = checkStringNumber(metadata,
        constants.frame_metadata.FRAME_METADATA_FRAME_COUNTER,
        constants.frame_metadata.FRAME_METADATA_COUNT,
        frameMetadata2Int,
        'Frame.frameMetadata(metadata) expects a number or string as the 1st argument',
        'Frame.frameMetadata(metadata) expects a valid value as the 1st argument');
    let array = new Uint8Array(8);
    return this.cxxFrame.getFrameMetadata(m, array) ? array : undefined;
  }

  /**
   * Determine if the device allows a specific metadata to be queried
   * @param {String|Number} metadata The type of metadata
   * @return {Boolean} true if supported, and false if not
   */
  supportsFrameMetadata(metadata) {
    let m = checkStringNumber(metadata,
        constants.frame_metadata.FRAME_METADATA_FRAME_COUNTER,
        constants.frame_metadata.FRAME_METADATA_COUNT,
        frameMetadata2Int,
        'Frame.supportsFrameMetadata(metadata) expects a number or string as the 1st argument',
        'Frame.supportsFrameMetadata(metadata) expects a valid value as the 1st argument');
    return this.cxxFrame.supportsFrameMetadata(m);
  }

  /**
   * Retrieve frame number
   * @return {Integer}
   */
  get frameNumber() {
    return this.cxxFrame.getFrameNumber();
  }

  /**
   * Retrieve the frame data
   * @return {Float32Array|Uint16Array|Uint8Array|undefined}
   * if the frame is from the depth stream, the return value is Uint16Array;
   * if the frame is from the XYZ32F or MOTION_XYZ32F stream, the return value is Float32Array;
   * for other cases, return value is Uint8Array.
   */
  get data() {
    if (this.typedArray) return this.typedArray;

    if (!this.arrayBuffer) {
      this.arrayBuffer = this.cxxFrame.getData();
      this.typedArray = undefined;
    }

    if (!this.arrayBuffer) return undefined;

    this.updateProfile();
    switch (this.format) {
      case constants.format.FORMAT_Z16:
      case constants.format.FORMAT_DISPARITY16:
      case constants.format.FORMAT_Y16:
      case constants.format.FORMAT_RAW16:
        this.typedArray = new Uint16Array(this.arrayBuffer);
        return this.typedArray;
      case constants.format.FORMAT_YUYV:
      case constants.format.FORMAT_UYVY:
      case constants.format.FORMAT_RGB8:
      case constants.format.FORMAT_BGR8:
      case constants.format.FORMAT_RGBA8:
      case constants.format.FORMAT_BGRA8:
      case constants.format.FORMAT_Y8:
      case constants.format.FORMAT_RAW8:
      case constants.format.FORMAT_MOTION_RAW:
      case constants.format.FORMAT_GPIO_RAW:
      case constants.format.FORMAT_RAW10:
      case constants.format.FORMAT_ANY:
        this.typedArray = new Uint8Array(this.arrayBuffer);
        return this.typedArray;
      case constants.format.FORMAT_XYZ32F:
      case constants.format.FORMAT_MOTION_XYZ32F:
        this.typedArray = new Float32Array(this.arrayBuffer);
        return this.typedArray;
    }
  }

  /**
   * Get the frame buffer data
   *  There are 2 acceptable forms of syntax:
   * <pre><code>
   *  Syntax 1. getData()
   *  Syntax 2. getData(ArrayBuffer)
   * </code></pre>
   *
   * @param {ArrayBuffer} [buffer] The buffer that will be written to.
   * @return {Float32Array|Uint16Array|Uint8Array|undefined}
   *  Returns a <code>TypedArray</code> or <code>undefined</code> for syntax 1,
   *   see {@link Frame#data};
   *  if syntax 2 is used, return value is not used (<code>undefined</code>).
   *
   * @see [Frame.dataByteLength]{@link Frame#dataByteLength} to determine the buffer size in bytes.
   */
  getData(buffer) {
    if (arguments.length === 0) return this.data;

    if (arguments.length === 1 && isArrayBuffer(buffer)) {
      return this.cxxFrame.writeData(buffer);
    }

    throw new TypeError('Frame.getData() expects 1 ArrayBuffer as a argument, or no argument');
  }

  /**
   * Get the data length in bytes
   * @return {Integer}
   */
  get dataByteLength() {
    return this.strideInBytes * this.height;
  }

  /**
   * Retrieve frame stride, meaning the actual line width in memory in bytes (not the logical image
   * width)
   * @return {Integer}
   */
  get strideInBytes() {
    return this.cxxFrame.getStrideInBytes();
  }
}

/**
 * This class resprents a video frame and is a subclass of Frame
 *
 * @property {Integer} width - The image width in pixels.
 * @property {Integer} height - The image height in pixels.
 * @property {Integer} strideInBytes - The stride of the frame. The unit is number of bytes.
 * @property {Integer} bitsPerPixel - The number of bits per pixel
 * @property {string} timestampDomain - Get the domain (clock name) of timestamp value.
 *
 */
class VideoFrame extends Frame {
  constructor(frame) {
    super(frame);
  }

  /**
   * Get image width in pixels
   * @return {Integer}
   */
  get width() {
    return this.cxxFrame.getWidth();
  }

  /**
   * Get image height in pixels
   * @return {Integer}
   */
  get height() {
    return this.cxxFrame.getHeight();
  }

  /**
   * Retrieve bits per pixel
   * @return {Integer}
   */
  get bitsPerPixel() {
    return this.cxxFrame.getBitsPerPixel();
  }

  /**
   * Retrieve bytes per pixel
   * @return {Integer}
   */
  get bytesPerPixel() {
    return this.cxxFrame.getBitsPerPixel()/8;
  }
}

/**
 * Class used to get 3D vertices and texture coordinates
 */
class Points extends Frame {
  constructor(cxxFrame) {
    super(cxxFrame);
  }

  /**
   * Get an array of 3D vertices.
   * The coordinate system is: X right, Y up, Z away from the camera. Units: Meters
   *
   * @return {Float32Array|undefined}
   */
  get vertices() {
    if (this.verticesArray) return this.verticesArray;

    if (this.cxxFrame.canGetPoints()) {
      const newLength = this.cxxFrame.getVerticesBufferLen();
      if (!this.verticesData || newLength !== this.verticesData.byteLength) {
        this.verticesData = new ArrayBuffer(newLength);
      }
      if (this.cxxFrame.writeVertices(this.verticesData)) {
        this.verticesArray = new Float32Array(this.verticesData);
        return this.verticesArray;
      }
    }
    return undefined;
  }

  release() {
    if (this.cxxFrame) this.cxxFrame.destroy();
    this.verticesArray = undefined;
    this.verticesCoordArray = undefined;
  }

  destroy() {
    this.release();
    this.verticesData = undefined;
    this.textureCoordData = undefined;
    this.cxxFrame = undefined;
  }

  /**
   * Get an array of texture coordinates per vertex
   * Each coordinate represent a (u,v) pair within [0,1] range, to be mapped to texture image
   *
   * @return {Int32Array|undefined}
   */
  get textureCoordinates() {
    if (this.verticesCoordArray) return this.verticesCoordArray;

    if (this.cxxFrame.canGetPoints()) {
      const newLength = this.cxxFrame.getTexCoordBufferLen();
      if (!this.textureCoordData || newLength !== this.textureCoordData.byteLength) {
        this.textureCoordData = new ArrayBuffer(newLength);
      }
      if (this.cxxFrame.writeTextureCoordinates(this.textureCoordData)) {
        this.verticesCoordArray = new Int32Array(this.textureCoordData);
        return this.verticesCoordArray;
      }
    }
    return undefined;
  }

  /**
   * Get number of vertices
   *
   * @return {Integer}
   */
  get size() {
    if (this.cxxFrame.canGetPoints()) {
      return this.cxxFrame.getPointsCount();
    }

    throw new TypeError('Can\'t get size due to invalid frame type');
  }
}

/**
 * This class represents depth stream
 */
class DepthFrame extends VideoFrame {
  constructor(cxxFrame) {
    super(cxxFrame);
  }

  /**
   * Get the distance of a point from the camera
   * @param {Integer} x x coordinate of the point
   * @param {Integer} y y coordinate of the point
   * @return {Float}
   */
  getDistance(x, y) {
    if ((arguments.length != 2) || (typeof x !== 'number') || (typeof y !== 'number')) {
      throw new TypeError('DepthFrame.getDistance(x, y) expects 2 integer arguments.');
    }

    return this.cxxFrame.getDistance(x, y);
  }
}

/**
 * Class containing a set of frames
 *
 * @property {Integer} size - count of frames.
 * @property {DepthFrame|undefined} depthFrame - The depth frame in the frameset.
 * @property {VideoFrame|undefined} colorFrame - The color frame in the frameset.
 */
class FrameSet {
  constructor(cxxFrameSet) {
    this.cxxFrameSet = cxxFrameSet || new RS2.RSFrameSet();
    this.cache = [];
    this.__update();
  }

  /**
   * Count of frames
   *
   * @return {Integer}
   */
  get size() {
    return this.sizeValue;
  }

  /**
   * Get the depth frame
   *
   * @return {DepthFrame|undefined}
   */
  get depthFrame() {
    return this.getFrame(stream.STREAM_DEPTH);
  }

  /**
   * Get the color frame
   *
   * @return {VideoFrame|undefined}
   */
  get colorFrame() {
    return this.getFrame(stream.STREAM_COLOR);
  }

  /**
   * Get the frame at specified index
   *
   * @param {Integer} index the index of the expected frame
   * @return {DepthFrame|VideoFrame|Frame|undefined}
   */
  at(index) {
    //
    // TODO(ting): mapping index to stream and use this.cache[]
    //   e.g. return getFrame(this.cxxFrameSet.indexToStream(index));
    //

    let cxxFrame = this.cxxFrameSet.at(index);

    if (!cxxFrame) return undefined;

    if (cxxFrame.isDepthFrame()) {
      return new DepthFrame(cxxFrame);
    }

    if (cxxFrame.isVideoFrame()) {
      return new VideoFrame(cxxFrame);
    }

    return new Frame(cxxFrame);
  }

  __internalAssembleFrame(cxxFrame) {
    if (!cxxFrame) return undefined;
    if (cxxFrame.isDepthFrame()) return new DepthFrame(cxxFrame);
    if (cxxFrame.isVideoFrame()) return new VideoFrame(cxxFrame);
    return new Frame(cxxFrame);
  }

  __internalGetFrame(stream) {
    let s = checkStringNumber(stream,
        constants.stream.STREAM_ANY, constants.stream.STREAM_COUNT,
        stream2Int,
        'FrameSet.getFrame() expects the argument to be string or integer',
        'FrameSet.getFrame()\'s argument value is invalid');
    return this.__internalAssembleFrame(this.cxxFrameSet.getFrame(s));
  }

  __internalGetFrameCache(stream, callback) {
    if (! this.cache[stream]) {
      this.cache[stream] = callback(stream);
    } else {
      let frame = this.cache[stream];
      if (!frame.cxxFrame) {
        frame.cxxFrame = new RS2.RSFrame();
      }
      if (! this.cxxFrameSet.replaceFrame(stream, frame.cxxFrame)) {
        this.cache[stream] = undefined;
      }
    }
    return this.cache[stream];
  }

  /**
   * Get the frame with specified stream
   *
   * @param {Integer|String} stream stream type of the frame
   * @return {DepthFrame|VideoFrame|Frame|undefined}
   */
  getFrame(stream) {
    return this.__internalGetFrameCache(stream, this.__internalGetFrame.bind(this));
  }

  __update() {
    this.sizeValue = this.cxxFrameSet.getSize();
  }

  releaseCache() {
    this.cache.forEach((f) => {
      if (f && f.cxxFrame) {
        f.release();
      }
    });
  }

  release() {
    this.releaseCache();
    if (this.cxxFrameSet) this.cxxFrameSet.destroy();
  }

  /**
   * Release resources associated with this object
   *
   * @return {undefined}
   */
  destroy() {
    this.release();
    this.cache = [];
    this.cxxFrameSet = undefined;
  }
}

/**
 * This class provides a simple way to retrieve frame data
 */
class Pipeline {
  /**
   * Construct a Pipeline object
   * There are 2 acceptable syntax
   *
   * <pre><code>
   *  Syntax 1. new Pipeline()
   *  Syntax 2. new Pipeline(context)
   * </code></pre>
   * Syntax 1 uses the default context.
   * Syntax 2 used the context created by application
   * @param {Context} [context] - the {@link Context} that is being used by the pipeline
   */
  constructor(context) {
    if (arguments.length > 1) {
      throw new TypeError('new Pipeline() can only accept at most 1 argument');
    }

    let ownCtx = true;
    let ctx;

    if (arguments.length === 1) {
      if (arguments[0] instanceof Context) {
        ownCtx = false;
        this.ctx = arguments[0];
      } else {
        throw new TypeError('new Pipeline() expects a Context argument');
      }
    }

    if (ownCtx === true) {
      this.ctx = new Context();
    }

    this.cxxPipeline = new RS2.RSPipeline();
    this.cxxPipeline.create(this.ctx.cxxCtx);
    this.started = false;
    this.frameSet = new FrameSet();
  }

  /**
   * Destroy the resource associated with this pipeline
   *
   * @return {undefined}
   */
  destroy() {
    if (this.started === true) this.stop();

    this.cxxPipeline.destroy();
    this.cxxPipeline = undefined;
    if (this.ownCtx) {
      this.ctx.destroy();
    }
    this.ctx = undefined;

    if (this.frameSet) {
      this.frameSet.destroy();
    }
    this.frameSet = undefined;
  }

  /**
   * Start streaming
   * There are 2 acceptable syntax
   *
   * <pre><code>
   *  Syntax 1. start()
   *  Syntax 2. start(config)
   * </code></pre>
   * Syntax 1 uses the default configuration.
   * Syntax 2 used the configured streams and or device of the config parameter
   *
   * @param {Config} [config] - the {@link Config} object to use for configuration
   * @return {@link PipelineProfile}
   */
  start() {
    if (this.started === true) return undefined;

    if (arguments.length === 0) {
      this.started = true;
      return new PipelineProfile(this.cxxPipeline.start());
    } else {
      if (!(arguments[0] instanceof Config)) {
        throw new TypeError('Invalid argument for Pipeline.start()');
      }
      this.started = true;
      return new PipelineProfile(this.cxxPipeline.startWithConfig(arguments[0].cxxConfig));
    }
    return undefined;
  }

  /**
   * Stop streaming
   *
   * @return {undefined}
   */
  stop() {
    if (this.started === false) return;

    if (this.cxxPipeline ) {
      this.cxxPipeline.stop();
    }
    this.started = false;

    if (this.frameSet) this.frameSet.release();
  }

  /**
   * Wait until a new set of frames becomes available.
   * The returned frameset includes time-synchronized frames of each enabled stream in the pipeline.
   * In case of different frame rates of the streams, the frames set include a matching frame of the
   * slow stream, which may have been included in previous frames set.
   * The method blocks the calling thread, and fetches the latest unread frames set.
   * Device frames, which were produced while the function wasn't called, are dropped.
   * To avoid frame drops, this method should be called as fast as the device frame rate.
   *
   * @param {Integer} timeout - max time to wait, in milliseconds, default to 5000 ms
   * @return {FrameSet|undefined} a FrameSet object or Undefined
   * @see See [Pipeline.latestFrame]{@link Pipeline#latestFrame}
   */
  waitForFrames() {
    if ((arguments.length === 1 && isNumber(arguments[0])) || arguments.length === 0) {
      const timeout = arguments[0] || 5000;
      this.frameSet.release();
      if (this.cxxPipeline.waitForFrames(this.frameSet.cxxFrameSet, timeout)) {
        this.frameSet.__update();
        return this.frameSet;
      }
      return undefined;
    }
    throw new TypeError('Pipeline.waitForFrames() expects an integer timeout argument');
  }

  get latestFrame() {
    return this.frameSet;
  }

  /**
   * Check if a new set of frames is available and retrieve the latest undelivered set.
   * The frameset includes time-synchronized frames of each enabled stream in the pipeline.
   * The method returns without blocking the calling thread, with status of new frames available
   * or not. If available, it fetches the latest frames set.
   * Device frames, which were produced while the function wasn't called, are dropped.
   * To avoid frame drops, this method should be called as fast as the device frame rate.
   *
   * @return {FrameSet|undefined}
   */
  pollForFrames() {
    this.frameSet.release();
    if (this.cxxPipeline.pollForFrames(this.frameSet.cxxFrameSet)) {
      this.frameSet.__update();
      return this.frameSet;
    }
    return undefined;
  }

  /**
   * Return the active device and streams profiles, used by the pipeline.
   * The pipeline streams profiles are selected during {@link Pipeline.start}. The method returns a
   * valid result only when the pipeline is active -
   * between calls to {@link Pipeline.start} and {@link Pipeline.stop}.
   * After {@link Pipeline.stop} is called, the pipeline doesn't own the device, thus, the pipeline
   * selected device may change in
   * subsequent activations.
   *
   * @return {PipelineProfile} the actual pipeline device and streams profile, which was
   * successfully configured to the streaming device on start.
   */
  getActiveProfile() {
    if (this.started === false) return undefined;

    return new PipelineProfile(this.cxxPipeline.getActiveProfile());
  }
}

/**
 * The pipeline profile includes a device and a selection of active streams, with specific profile.
 * The profile is a selection of the above under filters and conditions defined by the pipeline.
 * Streams may belong to more than one sensor of the device.
 */
class PipelineProfile {
  constructor(profile) {
    this.cxxPipelineProfile = profile;
  }

  /**
   * Return the selected streams profiles, which are enabled in this profile.
   *
   * @return {StreamProfile[]} an array of StreamProfile
   */
  getStreams() {
    let profiles = this.cxxPipelineProfile.getStreams();
    if (!profiles) return undefined;

    const array = [];
    profiles.forEach((profile) => {
      if (profile.isVideoProfile()) {
        array.push(new VideoStreamProfile(profile));
      } else {
        array.push(new StreamProfile(profile));
      }
    });
    return array;
  }

  /**
   * Retrieve the device used by the pipeline.
   * The device class provides the application access to control camera additional settings -
   * get device information, sensor options information, options value query and set, sensor
   * specific extensions.
   * Since the pipeline controls the device streams configuration, activation state and frames
   * reading, calling the device API functions, which execute those operations, results in
   * unexpected behavior. The pipeline streaming device is selected during {@link Pipeline.start}.
   * Devices of profiles, which are not returned by
   * {@link Pipeline.start} or {@link Pipeline.getActiveProfile}, are not guaranteed to be used by
   * the pipeline.
   *
   * @return {Device} the pipeline selected device
   */
  getDevice() {
    return new Device(this.cxxPipelineProfile.getDevice());
  }
}

/**
 * The config allows pipeline users to request filters for the pipeline streams and device selection
 * and configuration.
 * This is an optional step in pipeline creation, as the pipeline resolves its streaming device
 * internally.
 * Config provides its users a way to set the filters and test if there is no conflict with the
 * pipeline requirements from the device. It also allows the user to find a matching device for
 * the config filters and the pipeline, in order to select a device explicitly, and modify its
 * controls before streaming starts.
 */
class Config {
  constructor() {
    this.cxxConfig = new RS2.RSConfig();
  }

 /**
  * Enable a device stream explicitly, with selected stream parameters.
  * The method allows the application to request a stream with specific configuration. If no stream
  * is explicitly enabled, the pipeline configures the device and its streams according to the
  * attached computer vision modules and processing blocks requirements, or default configuration
  * for the first available device.
  * The application can configure any of the input stream parameters according to its requirement,
  * or set to 0 for don't care value. The config accumulates the application calls for enable
  * configuration methods, until the configuration is applied. Multiple enable stream calls for the
  * same stream override each other, and the last call is maintained.
  * Upon calling {@link Config.resolve}, the config checks for conflicts between the application
  * configuration requests and the attached computer vision modules and processing blocks
  * requirements, and fails if conflicts are found.
  * Before {@link Config.resolve} is called, no conflict check is done.
  *
  * @param {Integer|String} stream  stream type to be enabled
  * @param {Integer} index stream index, used for multiple streams of the same type. -1 indicates
  * any.
  * @param {Integer} width stream image width - for images streams. 0 indicates any.
  * @param {Integer} height stream image height - for images streams. 0 indicates any.
  * @param {Integer|String} format stream data format - pixel format for images streams, of data
  * type for other streams. format.FORMAT_ANY indicates any.
  * @param {Integer} fps stream frames per second. 0 indicates any.
  */
  enableStream(stream, index, width, height, format, fps) {
    let s = checkStringNumber(stream,
        constants.stream.STREAM_ANY, constants.stream.STREAM_COUNT,
        stream2Int,
        'Config.enableStream() expects a number or string to specify the stream',
        'Config.enableStream() expects a valid value to specify the stream');

    let f = checkStringNumber(format,
      constants.format.FORMAT_ANY, constants.format.FORMAT_COUNT,
      format2Int,
      'Config.enableStream() expects a property \'format\' to be string or integer',
      'Config.enableStream() expects a valid value to specify the format');

    this.cxxConfig.enableStream(s, index, width, height, f, fps);
  }

  /**
   * Disable a device stream explicitly, to remove any requests on this stream profile.
   */
  disableStream(stream) {
    let s = checkStringNumber(stream,
    constants.stream.STREAM_ANY, constants.stream.STREAM_COUNT,
    stream2Int,
    'Config.enableStream() expects a number or string to specify the stream',
    'Config.enableStream() expects a valid value to specify the stream');

    this.cxxConfig.disableStream(s);
  }

  /**
   * Enable all device streams explicitly.
   */
  enableAllStreams() {
    this.cxxConfig.enableAllStreams();
  }

  /**
   * Disable all device streams explicitly.
   */
  disableAllStreams() {
    this.cxxConfig.disableAllStreams();
  }

  /**
   * Select a specific device explicitly by its serial number, to be used by the pipeline.
   * The conditions and behavior of this method are similar to those of {@link Config.enableStream}.
   * This method is required if the application needs to set device or sensor settings prior to
   * pipeline streaming, to enforce the pipeline to use the configured device.
   *
   * @param {String} serial device serial number, as returned by
   * Device.getCameraInfo(camera_info.CAMERA_INFO_SERIAL_NUMBER).
   */
  enableDevice(serial) {
    this.cxxConfig.enableDevice(serial);
  }

  /**
   * Select a recorded device from a file, to be used by the pipeline through playback.
   * The device available streams are as recorded to the file, and {@link Config.resolve} considers
   * only this device and configuration as available.
   * This request cannot be used if {@link Config.enableRecordToFile} is called for the current
   * config, and vise versa
   *
   * @param {String} filename the playback file of the device
   */
  enableDeviceFromFile(filename) {
    this.cxxConfig.enableDeviceFromFile(filename);
  }

  /**
   * Requires that the resolved device would be recorded to file
   * This request cannot be used if {@link Config.enableDeviceFromFile} is called for the current
   * config, and vise versa as available.
   *
   * @param {String} filename the desired file for the output record
   */
  enableRecordToFile(filename) {
    this.cxxConfig.enableRecordToFile(filename);
  }

  /**
   * Resolve the configuration filters, to find a matching device and streams profiles.
   * The method resolves the user configuration filters for the device and streams, and combines
   * them with the requirements of the computer vision modules and processing blocks attached to the
   * pipeline. If there are no conflicts of requests,
   * it looks for an available device, which can satisfy all requests, and selects the first
   * matching streams configuration. In the absence of any request, the config selects the first
   * available device and the first color and depth streams configuration.
   * The pipeline profile selection during {@link Pipeline.start} follows the same method. Thus,
   * the selected profile is the same, if no change occurs to the available devices occurs.
   * Resolving the pipeline configuration provides the application access to the pipeline selected
   * device for advanced control.
   * The returned configuration is not applied to the device, so the application doesn't own the
   * device sensors. However, the application can call {@link Cofnig.enableDevice}, to enforce the
   * device returned by this method is selected by pipeline start, and configure the device and
   * sensors options or extensions before streaming starts.
   *
   * @param {Pipeline} pipeline the pipeline for which the selected filters are applied
   * @return {PipelineProfile|undefined} a matching device and streams profile, which satisfies the
   * filters and pipeline requests.
   */
  resolve(pipeline) {
    if (arguments.length === 0) {
        throw new TypeError('Invalid argument for Config.resolve()');
    } else {
      if (!(arguments[0] instanceof Pipeline)) {
        throw new TypeError('Invalid argument for Config.resolve()');
      }
      return new PipelineProfile(this.cxxConfig.resolve(arguments[0].cxxPipeline));
    }
    return undefined;
  }

  /**
   * Check if the config can resolve the configuration filters, to find a matching device and
   * streams profiles. The resolution conditions are as described in {@link Config.resolve}.
   *
   * @param {Pipeline} pipeline the pipeline for which the selected filters are applied
   * @return {boolean} true if a valid profile selection exists, false if no selection can be found
   * under the config filters and the available devices.
   */
  canResolve(pipeline) {
    if (arguments.length === 0) {
        throw new TypeError('Invalid argument for Config.canResolve()');
    } else {
      if (!(arguments[0] instanceof Pipeline)) {
        throw new TypeError('Invalid argument for Config.canResolve()');
      }
      return this.cxxConfig.canResolve(arguments[0].cxxPipeline);
    }
  }
}

/**
 * Syncer class, which is used to group synchronized frames into coherent frame-sets.
 */
class Syncer {
  constructor() {
    this.cxxSyncer = new RS2.RSSyncer();
    this.frameSet = new FrameSet();
  }

  /*
   * Wait until coherent set of frames becomes available
   * @param {Number} timeout Max time in milliseconds to wait until an exception will be thrown
   * @return {Frame[]|undefined} Set of coherent frames or undefined if no frames.
   */
  waitForFrames(timeout) {
    if ((arguments.length === 1 && isNumber(arguments[0])) || arguments.length === 0) {
      const timeout = arguments[0] || 5000;
      this.frameSet.release();
      if (this.cxxSyncer.waitForFrames(this.frameSet.cxxFrameSet, timeout)) {
        this.frameSet.__update();
        return this.frameSet;
      }
      return undefined;
    }
    throw new TypeError('Syncer.waitForFrames() expects an integer timeout argument');
  }

  /**
   * Check if a coherent set of frames is available, if yes return them
   * @return {Frame[]|undefined} an array of frames if available and undefined if not.
   */
  pollForFrames() {
    this.frameSet.release();
    if (this.cxxSyncer.pollForFrames(this.frameSet.cxxFrameSet)) {
      this.frameSet.__update();
      return this.frameSet;
    }
    return undefined;
  }

  /**
   * Release resources associated with the object
   */
  destroy() {
    this.cxxSyncer.destroy();
    this.cxxSyncer = undefined;
    if (this.frameset) {
      this.frameSet.destroy();
    }
    this.frameSet = undefined;
  }
}

/**
 * Encapsulate the handling of 'device-changed' notification, when devices are conncted or
 * disconnected. It can connect to the existing device(s) in system, and/or wait for the
 * arrival/removal of devices.
 */
class DeviceHub {
  /**
   * @param {Context} context - a librealsense2 Context
   */
  constructor(context) {
    this.context = context;
    this.cxxHub = new RS2.RSDeviceHub(context.cxxCtx);
  }

  /**
   * If any device is connected return it, otherwise wait until next RealSense device connects.
   * Calling this method multiple times will cycle through connected devices
   * @return {Device|undefined}
   */
  waitForDevice() {
    let dev = this.cxxHub.waitForDevice();
    return (dev ? new Device(dev) : undefined);
  }

  /**
   * Check if a device is connected
   * @return {Boolean}
   */
  isConnected(device) {
    return this.cxxHub.isConnected(device.cxxDev);
  }

  /**
   * Release resources associated with the object
   */
  destroy() {
    this.cxxHub.destroy();
    this.cxxHub = undefined;
  }
}

/**
 * <code>util.preset_preference</code>: The enum for preset preference values.
 * @readonly
 * @enum {String}
 */
const preset_preference = {
  /**
   * String literal of <code>'best-quality'</code>. <br>Prefers the best overall quality that is
   * available in the camera. <br>Equivalent to its uppercase counterpart.
   */
  best_quality: 'best-quality',
  /**
   * String literal of <code>'largest-image'</code>. <br>Prefers the largest image dimension that is
   * available in the camera. <br>Equivalent to its uppercase counterpart.
   */
  largest_image: 'largest-image',
  /**
   * String literal of <code>'highest-framerate'</code>. <br>Prefers the highest frame rate that is
   * available in the camera. <br>Equivalent to its uppercase counterpart.
   */
  highest_framerate: 'highest-framerate',

  /**
   * Prefers the best overall quality that is available in the camera <br>Equivalent to its
   * lowercase counterpart.
   * @type {Integer}
   */
  BEST_QUALITY: 0,
  /**
   * Prefers the largest image dimension that is available in the camera <br>Equivalent to its
   * lowercase counterpart.
   * @type {Integer}
   */
  LARGEST_IMAGE: 1,
  /**
   * Prefers the highest frame rate that is available in the camera <br>Equivalent to its lowercase
   * counterpart.
   * @type {Integer}
   */
  HIGHEST_FRAMERATE: 2,

  PRESET_BEGIN: 0,
  PRESET_END: 3,
};

const util = {};

util.preset_preference = preset_preference;

Object.defineProperty(util, '__stack', {
  get: function() {
    let orig = Error.prepareStackTrace;
    Error.prepareStackTrace = function(_, stack) {
   return stack;
  };
    let err = new Error();
    // TODO(kenny-y): fix the jshint error
    /* jshint ignore:start */
    Error.captureStackTrace(err, arguments.callee); // eslint-disable-line
    /* jshint ignore:end */
    let stack = err.stack;
    Error.prepareStackTrace = orig;
    return stack;
  },
});

Object.defineProperty(util, '__line', {
  get: function() {
    // TODO(kenny-y): fix the jshint error
    /* jshint ignore:start */
    return __stack[1].getLineNumber();
    /* jshint ignore:end */
  },
});

Object.defineProperty(util, '__file', {
  get: function() {
    // TODO(kenny-y): fix the jshint error
    /* jshint ignore:start */
    return __stack[1].getFileName().split('/').slice(-1)[0];
    /* jshint ignore:end */
  },
});

function isString(s) {
  return (typeof s === 'string');
}

function isNumber(s) {
  return (typeof s === 'number');
}

function checkStringNumber(v, rangeStart, rangeEnd, convertFunc, typeErrMsg, rangeErrMsg) {
  let r;
  if (isString(v)) {
    r = convertFunc(v);
  } else if (isNumber(v)) {
    r = parseInt(v);
  } else {
    throw new TypeError(typeErrMsg);
  }
  if (r < rangeStart || r >= rangeEnd || typeof r === 'undefined') {
    throw new RangeError(rangeErrMsg);
  }
  return r;
}

function range(start, end, step) {
  let a = [];
  step = parseInt(step) || 1;
  if (arguments.length === 1) {
    start = 0;
    end = parseInt(arguments[0]); // Count
  } else {
    start = parseInt(start);
    end = parseInt(end);
  }

  for (let i = start; i< end; i += step) {
    a.push(i);
  }
  return a;
}

function checkStreamProfileObject(profile) {
  if (typeof profile !== 'object') {
    throw new TypeError('The stream profile object is not an valid object');
  }
  let stream = checkStringNumber(profile.stream,
    constants.stream.STREAM_ANY, constants.stream.STREAM_COUNT,
    stream2Int,
    'StreamProfileObject expects a property \'stream\' to be string or integer',
    'StreamProfileObject\'s \'stream\' property value is invalid');
  if (!isNumber(profile.width)) {
    throw new TypeError('StreamProfileObject expects a property \'width\' to be an integer');
  }
  if (!isNumber(profile.height)) {
    throw new TypeError('StreamProfileObject expects a property \'height\' to be an integer');
  }
  if (!isNumber(profile.fps)) {
    throw new TypeError('StreamProfileObject expects a property \'fps\' to be an integer');
  }
  let format = checkStringNumber(profile.format,
      constants.format.FORMAT_ANY, constants.format.FORMAT_COUNT,
      format2Int,
      'StreamProfileObject expects a property \'format\' to be string or integer',
      'StreamProfileObject\'s \'format\' property value is invalid');
  return {
    stream: stream,
    width: profile.width,
    height: profile.height,
    fps: profile.fps,
    format: format,
  };
}

function equalsToEither(arg, strConst, numConst) {
  return (typeof arg === 'string' && arg === strConst) ||
         (typeof arg === 'number' && arg === numConst);
}

/**
 * Given a point in 3D space, compute the corresponding pixel coordinates in an image with no
 * distortion or forward distortion coefficients produced by the same camera.
 * @param {Intrinsics} intrinsics - The intrinsics of the image stream
 * @param {Object} pointCoordinate - The 3D space coordinate of the point, linke {x: 0, y: 0, z:1}.
 * @return {Object} like {x: 0, y:0}.
 */
util.projectPointToPixel = function(intrinsics, pointCoordinate) {
  if (equalsToEither(intrinsics.model,
      distortion.distortion_inverse_brown_conrady,
      distortion.DISTORTION_INVERSE_BROWN_CONRADY)) {
    throw new TypeError('projectPointToPixel cannot project to an inverse-distorted image');
  }

  let x = pointCoordinate.x / pointCoordinate.z;
  let y = pointCoordinate.y / pointCoordinate.z;

  if (equalsToEither(intrinsics.model,
      distortion.distortion_modified_brown_conrady,
      distortion.DISTORTION_MODIFIED_BROWN_CONRADY)) {
    const r2 = x * x + y * y;
    const f = 1 + intrinsics.coeffs[0] * r2 + intrinsics.coeffs[1] * r2 * r2 +
        intrinsics.coeffs[4] * r2 * r2 * r2;
    x *= f;
    y *= f;
    const dx = x + 2 * intrinsics.coeffs[2] * x * y + intrinsics.coeffs[3] * (r2 + 2 * x * x);
    const dy = y + 2 * intrinsics.coeffs[3] * x * y + intrinsics.coeffs[2] * (r2 + 2 * y * y);
    x = dx;
    y = dy;
  }

  if (equalsToEither(intrinsics.model,
      distortion.distortion_ftheta,
      distortion.DISTORTION_FTHETA)) {
    const r = Math.sqrt(x * x + y * y);
    const rd = (1.0 / intrinsics.coeffs[0] * Math.atan(2 * r * Math.tan(
        intrinsics.coeffs[0] / 2.0)));
    x *= rd / r;
    y *= rd / r;
  }
  return {x: x * intrinsics.fx + intrinsics.ppx, y: y * intrinsics.fy + intrinsics.ppy};
};

/**
 * Given pixel coordinates and depth in an image with no distortion or inverse distortion
 * coefficients, compute the corresponding point in 3D space relative to the same camera
 * @param {Intrinsics} intrinsics - The intrinsics of the depth stream
 * @param {Object} pixelCoordinate - The pixel coordinate of the point, linke {x: 0, y: 0}.
 * @param {Number} depth - The depth value of the point
 * @return {Object} like {x: 0, y:0, z:0}.
 */
util.deprojectPixelToPoint = function(intrinsics, pixelCoordinate, depth) {
  if (equalsToEither(intrinsics.model,
      distortion.distortion_modified_brown_conrady,
      distortion.DISTORTION_MODIFIED_BROWN_CONRADY)) {
    throw new TypeError('deprojectPixelToPoint cannot deproject from a forward-distorted image');
  }

  if (equalsToEither(intrinsics.model,
      distortion.distortion_ftheta,
      distortion.DISTORTION_FTHETA)) {
    throw new TypeError('deprojectPixelToPoint cannot deproject to an ftheta image');
  }

  let x = (pixelCoordinate.x - intrinsics.ppx) / intrinsics.fx;
  let y = (pixelCoordinate.y - intrinsics.ppy) / intrinsics.fy;

  if (equalsToEither(intrinsics.model,
      distortion.distortion_inverse_brown_conrady,
      distortion.DISTORTION_INVERSE_BROWN_CONRADY)) {
    const r2 = x * x + y * y;
    const f = 1 + intrinsics.coeffs[0] * r2 + intrinsics.coeffs[1] * r2 * r2 +
        intrinsics.coeffs[4] * r2 * r2 * r2;
    const ux = x * f + 2 * intrinsics.coeffs[2] * x * y + intrinsics.coeffs[3] * (r2 + 2 * x * x);
    const uy = y * f + 2 * intrinsics.coeffs[3] * x * y + intrinsics.coeffs[2] * (r2 + 2 * y * y);
    x = ux;
    y = uy;
  }

  return {x: depth * x, y: depth * y, z: depth};
};

/**
 * Transform 3D coordinates relative to one sensor to 3D coordinates relative to another viewpoint
 * @param {ExtrinsicsObject} extrinsics - The exrinsics from the original stream to the target
 * stream
 * @param {Object} pointCoordinate - The 3D space coordinate of the original point,
 * like {x: 0, y: 0, z:1}.
 * @return {Object} The tranformed 3D coordinate, like {x:0, y:0, z:0}.
 */
util.transformPointToPoint = function(extrinsics, pointCoordinate) {
  const x = extrinsics.rotation[0] * pointCoordinate.x +
            extrinsics.rotation[3] * pointCoordinate.y +
            extrinsics.rotation[6] * pointCoordinate.z +
            extrinsics.translation[0];
  const y = extrinsics.rotation[1] * pointCoordinate.x +
            extrinsics.rotation[4] * pointCoordinate.y +
            extrinsics.rotation[7] * pointCoordinate.z +
            extrinsics.translation[1];
  const z = extrinsics.rotation[2] * pointCoordinate.x +
            extrinsics.rotation[5] * pointCoordinate.y +
            extrinsics.rotation[8] * pointCoordinate.z +
            extrinsics.translation[2];
  return {x: x, y: y, z: z};
};

/**
 * Save the frame to a file asynchronously
 *
 * @param {path} target file path
 * @param {frame} frame to be saved
 * @param {fileFormat} the target file format, currently only 'png' is supported
 * @return {Promise}
 */
util.writeFrameToFileAsync = function(path, frame, fileFormat) {
  if (typeof fileFormat === 'string' && fileFormat.toLowerCase() === 'png') {
    let png = new PNG({
      width: frame.width,
      height: frame.height,
      inputColorType: 2,
      inputHasAlpha: false});
    png.data = frame.getData();
    return new Promise((resolve, reject) => {
      png.pack().pipe(fs.createWriteStream(path)).on('finish', () => {
        resolve();
      });
    });
  } else {
    throw new TypeError('util.writeFrameToFileAsync expects a string as the 3rd argument and only \'png\' is supported now.'); // eslint-disable-line
  }
};

/**
 * Save the frame to a file synchronously
 *
 * @param {path} target file path
 * @param {frame} frame to be saved
 * @param {fileFormat} the target file format, currently only 'png' is supported
 * @return {undefined}
 */
util.writeFrameToFile = function(path, frame, fileFormat) {
  if (typeof fileFormat === 'string' && fileFormat.toLowerCase() === 'png') {
    const opt = {
      width: frame.width,
      height: frame.height,
      inputColorType: 2,
      inputHasAlpha: false};
    const png = new PNG(opt);
    png.data = frame.getData();
    const buf = PNG.sync.write(png, opt);
    fs.writeFileSync(path, buf);
  } else {
    throw new TypeError('util.writeFrameToFile expects a string as the 3rd argument and only \'png\' is supported now.'); // eslint-disable-line
  }
};

/**
 * Get all the frame metadata representation as a string
 *
 * @param {frame} frame to be saved
 * @return {String} the string representation of all supported frame metadata.
 */
function frameMetadataContent(frame) {
  let content = 'Stream,' + stream.streamToString(frame.profile.streamType)+'\nMetadata Attribute,Value\n'; // eslint-disable-line
  for (let i = 0; i < frame_metadata.FRAME_METADATA_COUNT; i++) {
    if (frame.supportsFrameMetadata(i)) {
      content += frame_metadata.frameMetadataToString(i) + ',' + frame.frameMetadata(i) + '\n';
    }
  }
  return content;
}

/**
 * Save the frame metadata string representation to a file asynchronously
 *
 * @param {path} target file path
 * @param {frame} frame to extract metadata from
 * @return {undefined}
 */
util.writeFrameMetadataToFileAsync = function(path, frame) {
  return new Promise((resolve, reject) => {
    const content = frameMetadataContent(frame);
    fs.writeFile(path, content, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Save the frame metadata string representation to a file asynchronously
 *
 * @param {String} path target file path
 * @param {Frame} frame to extract metadata from
 * @return {undefined}
 */
util.writeFrameMetadataToFile = function(path, frame) {
  const content = frameMetadataContent(frame);
  const fd = fs.openSync(path, 'w');
  fs.writeSync(fd, content);
  fs.closeSync(fd);
};

/**
 * Enum for format values.
 * @readonly
 * @enum {String}
 */
const format = {

  /**
   * String literal of <code>'any'</code>. <br>When passed to enable stream, librealsense will try
   * to provide best suited format. <br>Equivalent to its uppercase counterpart.
   */
  format_any: 'any',
  /**
   * String literal of <code>'z16'</code>. <br>16-bit linear depth values. The depth is meters is
   * equal to depth scale * pixel value. <br>Equivalent to its uppercase counterpart.
   */
  format_z16: 'z16',
  /**
   * String literal of <code>'disparity16'</code>. <br>16-bit linear disparity values. The depth in
   * meters is equal to depth scale / pixel value. <br>Equivalent to its uppercase counterpart.
   */
  format_disparity16: 'disparity16',
  /**
   * String literal of <code>'xyz32f'</code>. <br>32-bit floating point 3D coordinates.
   * <br>Equivalent to its uppercase counterpart.
   */
  format_xyz32f: 'xyz32f',
  /**
   * String literal of <code>'yuyv'</code>. <br>Standard YUV pixel format as described in
   * https://en.wikipedia.org/wiki/YUV. <br>Equivalent to its uppercase counterpart.
   */
  format_yuyv: 'yuyv',
  /**
   * String literal of <code>'rgb8'</code>. <br>8-bit red, green and blue channels.
   * <br>Equivalent to its uppercase counterpart.
   */
  format_rgb8: 'rgb8',
  /**
   * String literal of <code>'bgr8'</code>. <br>8-bit blue, green, and red channels -- suitable for
   * OpenCV. <br>Equivalent to its uppercase counterpart.
   */
  format_bgr8: 'bgr8',
  /**
   * String literal of <code>'rgba8'</code>. <br>8-bit red, green and blue channels + constant
   * alpha channel equal to FF. <br>Equivalent to its uppercase counterpart.
   */
  format_rgba8: 'rgba8',
  /**
   * String literal of <code>'bgra8'</code>. <br>8-bit blue, green, and red channels + constant
   * alpha channel equal to FF. <br>Equivalent to its uppercase counterpart.
   */
  format_bgra8: 'bgra8',
  /**
   * String literal of <code>'y8'</code>. <br>8-bit per-pixel grayscale image.
   * <br>Equivalent to its uppercase counterpart.
   */
  format_y8: 'y8',
  /**
   * String literal of <code>'y16'</code>. <br>16-bit per-pixel grayscale image.
   * <br>Equivalent to its uppercase counterpart.
   */
  format_y16: 'y16',
  /**
   * String literal of <code>'raw10'</code>. <br>Four 10-bit luminance values encoded into
   * a 5-byte macropixel. <br>Equivalent to its uppercase counterpart.
   */
  format_raw10: 'raw10',
  /**
   * String literal of <code>'raw16'</code>. <br>16-bit raw image. <br>Equivalent to
   * its uppercase counterpart.
   */
  format_raw16: 'raw16',
  /**
   * String literal of <code>'raw8'</code>. <br>8-bit raw image. <br>Equivalent to
   * its uppercase counterpart.
   */
  format_raw8: 'raw8',
  /**
   * String literal of <code>'uyvy'</code>. <br>Similar to the standard YUYV pixel
   * format, but packed in a different order. <br>Equivalent to its uppercase counterpart.
   */
  format_uyvy: 'uyvy',
  /**
   * String literal of <code>'motion_raw'</code>. <br>Raw data from the motion sensor.
   * <br>Equivalent to its uppercase counterpart.
   */
  format_motion_raw: 'motion-raw',
  /**
   * String literal of <code>'motion_xyz32f'</code>. <br>Motion data packed as 3 32-bit
   * float values, for X, Y, and Z axis. <br>Equivalent to its uppercase counterpart.
   */
  format_motion_xyz32f: 'motion-xyz32f',
  /**
   * String literal of <code>'gpio-raw'</code>. <br>Raw data from the external sensors
   * hooked to one of the GPIO's. <br>Equivalent to its uppercase counterpart.
   */
  format_gpio_raw: 'gpio-raw',

  /**
   * When passed to enable stream, librealsense will try to provide best suited
   * format. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_ANY: RS2.RS2_FORMAT_ANY,
  /**
   * 16-bit linear depth values. The depth is meters is equal to depth
   * scale * pixel value. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_Z16: RS2.RS2_FORMAT_Z16,
  /**
   * 16-bit linear disparity values. The depth in meters is equal to depth
   * scale / pixel value. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_DISPARITY16: RS2.RS2_FORMAT_DISPARITY16,
  /**
   * 32-bit floating point 3D coordinates. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_XYZ32F: RS2.RS2_FORMAT_XYZ32F,
  /**
   * Standard YUV pixel format as described in https://en.wikipedia.org/wiki/YUV.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_YUYV: RS2.RS2_FORMAT_YUYV,
  /**
   * 8-bit red, green and blue channels. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_RGB8: RS2.RS2_FORMAT_RGB8,
  /**
   * 8-bit blue, green, and red channels -- suitable for OpenCV. <br>Equivalent to its lowercase
   * counterpart.
   * @type {Integer}
   */
  FORMAT_BGR8: RS2.RS2_FORMAT_BGR8,
  /**
   * 8-bit red, green and blue channels + constant alpha channel equal to FF. <br>Equivalent to
   * its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_RGBA8: RS2.RS2_FORMAT_RGBA8,
  /**
   * 8-bit blue, green, and red channels + constant alpha channel equal to FF. <br>Equivalent to
   * its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_BGRA8: RS2.RS2_FORMAT_BGRA8,
  /**
   * 8-bit per-pixel grayscale image. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_Y8: RS2.RS2_FORMAT_Y8,
  /**
   * 16-bit per-pixel grayscale image. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_Y16: RS2.RS2_FORMAT_Y16,
  /**
   * Four 10-bit luminance values encoded into a 5-byte macropixel. <br>Equivalent to its
   * lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_RAW10: RS2.RS2_FORMAT_RAW10,
  /**
   * 16-bit raw image. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_RAW16: RS2.RS2_FORMAT_RAW16,
  /**
   * 8-bit raw image. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_RAW8: RS2.RS2_FORMAT_RAW8,
  /**
   * Similar to the standard YUYV pixel format, but packed in a different order. <br>Equivalent to
   * its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_UYVY: RS2.RS2_FORMAT_UYVY,
  /**
   * Raw data from the motion sensor. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_MOTION_RAW: RS2.RS2_FORMAT_MOTION_RAW,
  /**
   * Motion data packed as 3 32-bit float values, for X, Y, and Z axis. <br>Equivalent to its
   * lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_MOTION_XYZ32F: RS2.RS2_FORMAT_MOTION_XYZ32F,
  /**
   * Raw data from the external sensors hooked to one of the GPIO's. <br>Equivalent to its
   * lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_GPIO_RAW: RS2.RS2_FORMAT_GPIO_RAW,
  /**
   * Number of enumeration values. Not a valid input: intended to be used in for-loops.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  FORMAT_COUNT: RS2.RS2_FORMAT_COUNT,

  /**
   * Get the string representation out of the integer format type
   * @param {Integer} format the format type
   * @return {String}
   */
  formatToString: function(format) {
    if (arguments.length !== 1) {
      throw new TypeError('format.formatToString(format) expects 1 argument');
    } else {
      let i = checkStringNumber(arguments[0],
          this.FORMAT_ANY, this.FORMAT_COUNT,
          format2Int,
          'format.formatToString(format) expects a number or string as the 1st argument',
          'format.formatToString(format) expects a valid value as the 1st argument');
      switch (i) {
        case this.FORMAT_ANY:
          return this.format_any;
        case this.FORMAT_Z16:
          return this.format_z16;
        case this.FORMAT_DISPARITY16:
          return this.format_disparity16;
        case this.FORMAT_XYZ32F:
          return this.format_xyz32f;
        case this.FORMAT_YUYV:
          return this.format_yuyv;
        case this.FORMAT_RGB8:
          return this.format_rgb8;
        case this.FORMAT_BGR8:
          return this.format_bgr8;
        case this.FORMAT_RGBA8:
          return this.format_rgba8;
        case this.FORMAT_BGRA8:
          return this.format_bgra8;
        case this.FORMAT_Y8:
          return this.format_y8;
        case this.FORMAT_Y16:
          return this.format_y16;
        case this.FORMAT_RAW10:
          return this.format_raw10;
        case this.FORMAT_RAW16:
          return this.format_raw16;
        case this.FORMAT_RAW8:
          return this.format_raw8;
        case this.FORMAT_UYVY:
          return this.format_uyvy;
        case this.FORMAT_MOTION_RAW:
          return this.format_motion_raw;
        case this.FORMAT_MOTION_XYZ32F:
          return this.format_motion_xyz32f;
        case this.FORMAT_GPIO_RAW:
          return this.format_gpio_raw;
      }
    }
  },
};


/**
 * Enum for stream values.
 * @readonly
 * @enum {String}
 */
const stream = {
    /**
     * String literal of <code>'any'</code>. <br>Any stream. <br>Equivalent
     * to its uppercase counterpart.
     */
    stream_any: 'any',
    /**
     * String literal of <code>'depth'</code>. <br>Native stream of depth data
     * produced by RealSense device . <br>Equivalent to its uppercase counterpart.
     */
    stream_depth: 'depth',
    /**
     * String literal of <code>'color'</code>. <br>Native stream of color data
     * captured by RealSense device . <br>Equivalent to its uppercase counterpart.
     */
    stream_color: 'color',
    /**
     * String literal of <code>'infrared'</code>. <br>Native stream of infrared data
     * captured by RealSense device . <br>Equivalent to its uppercase counterpart.
     */
    stream_infrared: 'infrared',
    /**
     * String literal of <code>'fisheye'</code>. <br>Native stream of fish-eye(wide) data
     * captured from the dedicate motion camera . <br>Equivalent to its uppercase counterpart.
     */
    stream_fisheye: 'fisheye',
    /**
     * String literal of <code>'gyro'</code>. <br>Native stream of gyroscope motion
     * data produced by RealSense device . <br>Equivalent to its uppercase counterpart.
     */
    stream_gyro: 'gyro',
    /**
     * String literal of <code>'accel'</code>. <br>Native stream of accelerometer motion
     * data produced by RealSense device . <br>Equivalent to its uppercase counterpart.
     */
    stream_accel: 'accel',
    /**
     * String literal of <code>'gpio'</code>. <br>Signals from external device connected
     * through GPIO . <br>Equivalent to its uppercase counterpart.
     */
    stream_gpio: 'gpio',

    /**
     * Any stream. <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    STREAM_ANY: RS2.RS2_STREAM_ANY,
    /**
     * Native stream of depth data produced by RealSense device. <br>Equivalent to its
     * lowercase counterpart.
     * @type {Integer}
     */
    STREAM_DEPTH: RS2.RS2_STREAM_DEPTH,
    /**
     * Native stream of color data captured by RealSense device. <br>Equivalent to its
     * lowercase counterpart.
     * @type {Integer}
     */
    STREAM_COLOR: RS2.RS2_STREAM_COLOR,
    /**
     * Native stream of infrared data captured by RealSense device. <br>Equivalent to its
     * lowercase counterpart.
     * @type {Integer}
     */
    STREAM_INFRARED: RS2.RS2_STREAM_INFRARED,
    /**
     * Native stream of fish-eye (wide) data captured from the dedicate motion camera.
     * <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    STREAM_FISHEYE: RS2.RS2_STREAM_FISHEYE,
    /**
     * Native stream of gyroscope motion data produced by RealSense device. <br>Equivalent to
     * its lowercase counterpart.
     * @type {Integer}
     */
    STREAM_GYRO: RS2.RS2_STREAM_GYRO,
    /**
     * Native stream of accelerometer motion data produced by RealSense device. <br>Equivalent to
     * its lowercase counterpart.
     * @type {Integer}
     */
    STREAM_ACCEL: RS2.RS2_STREAM_ACCEL,
    /**
     * Signals from external device connected through GPIO. <br>Equivalent to its
     * lowercase counterpart.
     * @type {Integer}
     */
    STREAM_GPIO: RS2.RS2_STREAM_GPIO,

    /**
     * Number of enumeration values. Not a valid input: intended to be used in for-loops.
     * @type {Integer}
    */
    STREAM_COUNT: RS2.RS2_STREAM_COUNT,

    /**
     * Get the string representation out of the integer stream type
     * @param {Integer} stream the stream type
     * @return {String}
     */
    streamToString: function(stream) {
      if (arguments.length !== 1) {
        throw new TypeError('stream.streamToString(stream) expects 1 argument');
      } else {
        let i = checkStringNumber(arguments[0],
            this.STREAM_ANY, this.STREAM_COUNT,
            stream2Int,
            'stream.streamToString(stream) expects a number or string as the 1st argument',
            'stream.streamToString(stream) expects a valid value as the 1st argument');
        switch (i) {
          case this.STREAM_ANY:
            return this.stream_any;
          case this.STREAM_DEPTH:
            return this.stream_depth;
          case this.STREAM_COLOR:
            return this.stream_color;
          case this.STREAM_INFRARED:
            return this.stream_infrared;
          case this.STREAM_FISHEYE:
            return this.stream_fisheye;
          case this.STREAM_GYRO:
            return this.stream_gyro;
          case this.STREAM_ACCEL:
            return this.stream_accel;
          case this.STREAM_GPIO:
            return this.stream_gpio;
        }
      }
    },
};

/**
 * Enum for recording options
 * @readonly
 * @enum {String}
 * @see See [RecordingContext.constructor()]{@link RecordingContext} for usage
 */
const recording_mode = {
  /**
   * String literal of <code>'blank-frames'</code>. <br>Frame metadata will be recorded,
   * but pixel data will be replaced with zeros to save space. <br>Equivalent to its uppercase
   * counterpart.
   */
  blank_frames: 'blank-frames',
  /**
   * String literal of <code>'compressed'</code>. <br>Frames will be encoded using a proprietary
   * lossy encoding, aiming at x5 compression at some CPU expense. <br>Equivalent to its uppercase
   * counterpart.
   */
  compressed: 'compressed',
  /**
   * String literal of <code>'best-quality'</code>. <br>Frames will not be compressed,
   * but rather stored as-is. This gives best quality and low CPU overhead, but you might run out
   * of memory. <br>Equivalent to its uppercase counterpart.
   */
  best_quality: 'best-quality',

  /**
   * Frame metadata will be recorded, but pixel data will be replaced with zeros to save space.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  BLANK_FRAMES: RS2.RS2_RECORDING_MODE_BLANK_FRAMES,
  /**
   * Frames will be encoded using a proprietary lossy encoding, aiming at x5 compression at some
   * CPU expense.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  COMPRESSED: RS2.RS2_RECORDING_MODE_COMPRESSED,
  /**
   * Frames will not be compressed, but rather stored as-is. This gives best quality and low CPU
   * overhead, but you might run out of memory.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  BEST_QUALITY: RS2.RS2_RECORDING_MODE_BEST_QUALITY,
};

/**
 * Enum for option values.
 * @readonly
 * @enum {String}
 * @see [Sensor.isOptionReadOnly()]{@link Sensor#isOptionReadOnly}
 * @see [Sensor.getOption()]{@link Sensor#getOption}
 * @see [Sensor.getOptionRange()]{@link Sensor#getOptionRange}
 * @see [Sensor.setOption()]{@link Sensor#setOption}
 * @see [Sensor.supportsOption()]{@link Sensor#supportsOption}
 * @see [Sensor.getOptionDescription()]{@link Sensor#getOptionDescription}
 * @see [Sensor.getOptionValueDescription()]{@link Sensor#getOptionValueDescription}
 */

const option = {
  /**
   * String literal of <code>'backlight-compensation'</code>. <br>Enable / disable color
   * backlight compensation. <br>Equivalent to its uppercase counterpart.
   */
  option_backlight_compensation: 'backlight-compensation',
  /**
   * String literal of <code>'brightness'</code>. <br>Color image brightness. <br>Equivalent
   * to its uppercase counterpart.
   */
  option_brightness: 'brightness',
  /**
   * String literal of <code>'contrast'</code>. <br>Color image contrast. <br>Equivalent
   * to its uppercase counterpart.
   */
  option_contrast: 'contrast',
  /**
   * String literal of <code>'exposure'</code>. <br>Controls exposure time of color camera
   *. Setting any value will disable auto exposure. <br>Equivalent to its uppercase counterpart.
   */
  option_exposure: 'exposure',
  /**
   * String literal of <code>'gain'</code>. <br>Color image gain. <br>Equivalent to its
   * uppercase counterpart.
   */
  option_gain: 'gain',
  /**
   * String literal of <code>'gamma'</code>. <br>Color image gamma setting. <br>Equivalent
   * to its uppercase counterpart.
   */
  option_gamma: 'gamma',
  /**
   * String literal of <code>'hue'</code>. <br>Color image hue. <br>Equivalent to its
   * uppercase counterpart.
   */
  option_hue: 'hue',
  /**
   * String literal of <code>'saturation'</code>. <br>Color image saturation setting.
   * <br>Equivalent to its uppercase counterpart.
   */
  option_saturation: 'saturation',
  /**
   * String literal of <code>'sharpness'</code>. <br>Color image sharpness setting.
   * <br>Equivalent to its uppercase counterpart.
   */
  option_sharpness: 'sharpness',
  /**
   * String literal of <code>'white-balance'</code>. <br>Controls white balance of color
   * image. Setting any value will disable auto white balance. <br>Equivalent to its uppercase
   * counterpart.
   */
  option_white_balance: 'white-balance',
  /**
   * String literal of <code>'enable-auto-exposure'</code>. <br>Enable / disable color
   * image auto-exposure. <br>Equivalent to its uppercase counterpart.
   */
  option_enable_auto_exposure: 'enable-auto-exposure',
  /**
   * String literal of <code>'enable-auto-white-balance'</code>. <br>Enable / disable
   * color image auto-white-balance. <br>Equivalent to its uppercase counterpart.
   */
  option_enable_auto_white_balance: 'enable-auto-white-balance',
  /**
   * String literal of <code>'visual-preset'</code>. <br>Provide access to several recommend
   * sets of option presets for the depth camera . <br>Equivalent to its uppercase counterpart.
   */
  option_visual_preset: 'visual-preset',
  /**
   * String literal of <code>'laser-power'</code>. <br>Power of the F200 / SR300 projector
   *, with 0 meaning projector off. <br>Equivalent to its uppercase counterpart.
   */
  option_laser_power: 'laser-power',
  /**
   * String literal of <code>'accuracy'</code>. <br>Set the number of patterns projected
   * per frame. The higher the accuracy value the more patterns projected. Increasing the number
   * of patterns help to achieve better accuracy. Note that this control is affecting the Depth FPS.
   * <br>Equivalent to its uppercase counterpart.
   */
  option_accuracy: 'accuracy',
  /**
   * String literal of <code>'motion-range'</code>. <br>Motion vs. Range trade-off, with
   * lower values allowing for better motion sensitivity and higher values allowing for better
   * depth range. <br>Equivalent to its uppercase counterpart.
   */
  option_motion_range: 'motion-range',
  /**
   * String literal of <code>'filter-option'</code>. <br>Set the filter to apply to each
   * depth frame. Each one of the filter is optimized per the application requirements.
   * <br>Equivalent to its uppercase counterpart.
   */
  option_filter_option: 'filter-option',
  /**
   * String literal of <code>'confidence-threshold'</code>. <br>The confidence level threshold
   * used by the Depth algorithm pipe to set whether a pixel will get a valid range or will 
   * be marked with invalid range. <br>Equivalent to its uppercase counterpart.
   */
  option_confidence_threshold: 'confidence-threshold',
  /**
   * String literal of <code>'emitter-enabled'</code>. <br>Laser Emitter enabled .
   * <br>Equivalent to its uppercase counterpart.
   */
  option_emitter_enabled: 'emitter-enabled',
  /**
   * String literal of <code>'frames-queue-size'</code>. <br>Number of frames the user
   * is allowed to keep per stream. Trying to hold-on to more frames will cause frame-drops.
   * <br>Equivalent to its uppercase counterpart.
   */
  option_frames_queue_size: 'frames-queue-size',
  /**
   * String literal of <code>'total-frame-drops'</code>. <br>Total number of detected
   * frame drops from all streams . <br>Equivalent to its uppercase counterpart.
   */
  option_total_frame_drops: 'total-frame-drops',
  /**
   * String literal of <code>'auto-exposure-mode'</code>. <br>Auto-Exposure modes: Static
   *, Anti-Flicker and Hybrid . <br>Equivalent to its uppercase counterpart.
   */
  option_auto_exposure_mode: 'auto-exposure-mode',
  /**
   * String literal of <code>'power-line-frequency'</code>. <br>Power Line Frequency control
   * for anti-flickering, Off/50Hz/60Hz/Auto. <br>Equivalent to its uppercase counterpart.
   */
  option_power_line_frequency: 'power-line-frequency',
  /**
   * String literal of <code>'asic-temperature'</code>. <br>Current Asic Temperature .
   * <br>Equivalent to its uppercase counterpart.
   */
  option_asic_temperature: 'asic-temperature',
  /**
   * String literal of <code>'error-polling-enabled'</code>. <br>disable error handling
   * . <br>Equivalent to its uppercase counterpart.
   */
  option_error_polling_enabled: 'error-polling-enabled',
  /**
   * String literal of <code>'projector-temperature'</code>. <br>Current Projector Temperature
   * . <br>Equivalent to its uppercase counterpart.
   */
  option_projector_temperature: 'projector-temperature',
  /**
   * String literal of <code>'output-trigger-enabled'</code>. <br>Enable / disable trigger
   * to be outputed from the camera to any external device on every depth frame.
   * <br>Equivalent to its uppercase counterpart.
   */
  option_output_trigger_enabled: 'output-trigger-enabled',
  /**
   * String literal of <code>'motion-module-temperature'</code>. <br>Current Motion-Module
   * Temperature . <br>Equivalent to its uppercase counterpart.
   */
  option_motion_module_temperature: 'motion-module-temperature',
  /**
   * String literal of <code>'depth-units'</code>. <br>Number of meters represented by
   * a single depth unit . <br>Equivalent to its uppercase counterpart.
   */
  option_depth_units: 'depth-units',
  /**
   * String literal of <code>'enable-motion-correction'</code>. <br>Enable/Disable automatic
   * correction of the motion data . <br>Equivalent to its uppercase counterpart.
   */
  option_enable_motion_correction: 'enable-motion-correction',

  /**
   * Enable / disable color backlight compensatio.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_BACKLIGHT_COMPENSATION: RS2.RS2_OPTION_BACKLIGHT_COMPENSATION,
  /**
   * Color image brightnes.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_BRIGHTNESS: RS2.RS2_OPTION_BRIGHTNESS,
  /**
   * Color image contras.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_CONTRAST: RS2.RS2_OPTION_CONTRAST,
  /**
   * Controls exposure time of color camera. Setting any value will disable auto exposur.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_EXPOSURE: RS2.RS2_OPTION_EXPOSURE,
  /**
   * Color image gai.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_GAIN: RS2.RS2_OPTION_GAIN,
  /**
   * Color image gamma settin.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_GAMMA: RS2.RS2_OPTION_GAMMA,
  /**
   * Color image hu.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_HUE: RS2.RS2_OPTION_HUE,
  /**
   * Color image saturation settin.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_SATURATION: RS2.RS2_OPTION_SATURATION,
  /**
   * Color image sharpness settin.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_SHARPNESS: RS2.RS2_OPTION_SHARPNESS,
  /**
   * Controls white balance of color image. Setting any value will disable auto white balanc.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_WHITE_BALANCE: RS2.RS2_OPTION_WHITE_BALANCE,
  /**
   * Enable / disable color image auto-exposur.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_ENABLE_AUTO_EXPOSURE: RS2.RS2_OPTION_ENABLE_AUTO_EXPOSURE,
  /**
   * Enable / disable color image auto-white-balanc.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_ENABLE_AUTO_WHITE_BALANCE: RS2.RS2_OPTION_ENABLE_AUTO_WHITE_BALANCE,
  /**
   * Provide access to several recommend sets of option presets for the depth camera.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_VISUAL_PRESET: RS2.RS2_OPTION_VISUAL_PRESET,
  /**
   * Power of the F200 / SR300 projector, with 0 meaning projector of.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_LASER_POWER: RS2.RS2_OPTION_LASER_POWER,
  /**
   * Set the number of patterns projected per frame. The higher the accuracy value the more
   * patterns projected. Increasing the number of patterns help to achieve better accuracy. Note
   * that this control is affecting the Depth FPS.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_ACCURACY: RS2.RS2_OPTION_ACCURACY,
  /**
   * Motion vs. Range trade-off, with lower values allowing for better motion sensitivity and
   * higher values allowing for better depth rang.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_MOTION_RANGE: RS2.RS2_OPTION_MOTION_RANGE,
  /**
   * Set the filter to apply to each depth frame. Each one of the filter is optimized per the
   * application requirement.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_FILTER_OPTION: RS2.RS2_OPTION_FILTER_OPTION,
  /**
   * The confidence level threshold used by the Depth algorithm pipe to set whether a pixel will
   * get a valid range or will be marked with invalid rang.<br>Equivalent to its lowercase
   * counterpart.
   * @type {Integer}
   */
  OPTION_CONFIDENCE_THRESHOLD: RS2.RS2_OPTION_CONFIDENCE_THRESHOLD,
  /**
   * Laser Emitter enabled.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_EMITTER_ENABLED: RS2.RS2_OPTION_EMITTER_ENABLED,
  /**
   * Number of frames the user is allowed to keep per stream. Trying to hold-on to more frames will
   * cause frame-drops.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_FRAMES_QUEUE_SIZE: RS2.RS2_OPTION_FRAMES_QUEUE_SIZE,
  /**
   * Total number of detected frame drops from all streams.<br>Equivalent to its lowercase
   * counterpart.
   * @type {Integer}
   */
  OPTION_TOTAL_FRAME_DROPS: RS2.RS2_OPTION_TOTAL_FRAME_DROPS,
  /**
   * Auto-Exposure modes: Static, Anti-Flicker and Hybrid.<br>Equivalent to its lowercase
   * counterpart.
   * @type {Integer}
   */
  OPTION_AUTO_EXPOSURE_MODE: RS2.RS2_OPTION_AUTO_EXPOSURE_MODE,
  /**
   * Power Line Frequency control for anti-flickering, Off/50Hz/60Hz/Auto.<br>Equivalent to its
   * lowercase counterpart.
   * @type {Integer}
   */
  OPTION_POWER_LINE_FREQUENCY: RS2.RS2_OPTION_POWER_LINE_FREQUENCY,
  /**
   * Current Asic Temperature.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_ASIC_TEMPERATURE: RS2.RS2_OPTION_ASIC_TEMPERATURE,
  /**
   * disable error handling.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_ERROR_POLLING_ENABLED: RS2.RS2_OPTION_ERROR_POLLING_ENABLED,
  /**
   * Current Projector Temperature.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_PROJECTOR_TEMPERATURE: RS2.RS2_OPTION_PROJECTOR_TEMPERATURE,
  /**
   * Enable / disable trigger to be outputed from the camera to any external device on every depth
   * frame.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_OUTPUT_TRIGGER_ENABLED: RS2.RS2_OPTION_OUTPUT_TRIGGER_ENABLED,
  /**
   * Current Motion-Module Temperature.<br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  OPTION_MOTION_MODULE_TEMPERATURE: RS2.RS2_OPTION_MOTION_MODULE_TEMPERATURE,
  /**
   * Number of meters represented by a single depth unit.<br>Equivalent to its lowercase
   * counterpart.
   * @type {Integer}
   */
  OPTION_DEPTH_UNITS: RS2.RS2_OPTION_DEPTH_UNITS,
  /**
   * Enable/Disable automatic correction of the motion data.<br>Equivalent to its lowercase
   * counterpart.
   * @type {Integer}
   */
  OPTION_ENABLE_MOTION_CORRECTION: RS2.RS2_OPTION_ENABLE_MOTION_CORRECTION,
  /**
   * Number of enumeration values. Not a valid input: intended to be used in for-loops.
   * @type {Integer}
   */
  OPTION_COUNT: RS2.RS2_OPTION_COUNT,

  /**
   * Get the string representation out of the integer option type
   * @param {Integer} option the option type
   * @return {String}
   */
  optionToString: function(option) {
    if (arguments.length !== 1) {
      throw new TypeError('option.optionToString(option) expects 1 argument');
    } else {
      let i = checkStringNumber(arguments[0],
          this.OPTION_BACKLIGHT_COMPENSATION, this.OPTION_COUNT,
          option2Int,
          'option.optionToString(option) expects a number or string as the 1st argument',
          'option.optionToString(option) expects a valid value as the 1st argument');
      switch (i) {
        case this.OPTION_BACKLIGHT_COMPENSATION:
          return this.option_backlight_compensation;
        case this.OPTION_BRIGHTNESS:
          return this.option_brightness;
        case this.OPTION_CONTRAST:
          return this.option_contrast;
        case this.OPTION_EXPOSURE:
          return this.option_exposure;
        case this.OPTION_GAIN:
          return this.option_gain;
        case this.OPTION_GAMMA:
          return this.option_gamma;
        case this.OPTION_HUE:
          return this.option_hue;
        case this.OPTION_SATURATION:
          return this.option_saturation;
        case this.OPTION_SHARPNESS:
          return this.option_sharpness;
        case this.OPTION_WHITE_BALANCE:
          return this.option_white_balance;
        case this.OPTION_ENABLE_AUTO_EXPOSURE:
          return this.option_enable_auto_exposure;
        case this.OPTION_ENABLE_AUTO_WHITE_BALANCE:
          return this.option_enable_auto_white_balance;
        case this.OPTION_VISUAL_PRESET:
          return this.option_visual_preset;
        case this.OPTION_LASER_POWER:
          return this.option_laser_power;
        case this.OPTION_ACCURACY:
          return this.option_accuracy;
        case this.OPTION_MOTION_RANGE:
          return this.option_motion_range;
        case this.OPTION_FILTER_OPTION:
          return this.option_filter_option;
        case this.OPTION_CONFIDENCE_THRESHOLD:
          return this.option_confidence_threshold;
        case this.OPTION_EMITTER_ENABLED:
          return this.option_emitter_enabled;
        case this.OPTION_FRAMES_QUEUE_SIZE:
          return this.option_frames_queue_size;
        case this.OPTION_TOTAL_FRAME_DROPS:
          return this.option_total_frame_drops;
        case this.OPTION_AUTO_EXPOSURE_MODE:
          return this.option_auto_exposure_mode;
        case this.OPTION_POWER_LINE_FREQUENCY:
          return this.option_power_line_frequency;
        case this.OPTION_ASIC_TEMPERATURE:
          return this.option_asic_temperature;
        case this.OPTION_ERROR_POLLING_ENABLED:
          return this.option_error_polling_enabled;
        case this.OPTION_PROJECTOR_TEMPERATURE:
          return this.option_projector_temperature;
        case this.OPTION_OUTPUT_TRIGGER_ENABLED:
          return this.option_output_trigger_enabled;
        case this.OPTION_MOTION_MODULE_TEMPERATURE:
          return this.option_motion_module_temperature;
        case this.OPTION_DEPTH_UNITS:
          return this.option_depth_units;
        case this.OPTION_ENABLE_MOTION_CORRECTION:
          return this.option_enable_motion_correction;
      }
    }
  },
};

/**
 * Enum for camera info types
 * @readonly
 * @enum {String}
 * @see [Device.supportsCameraInfo()]{@link Device#supportsCameraInfo}
 */
const camera_info = {
  /**
   * String literal of <code>'name'</code>. <br>Device friendly name. <br>Equivalent to its
   * uppercase counterpart.
   *
   */
  camera_info_name: 'name',
  /**
   * String literal of <code>'serial-number'</code>. <br>Serial number. <br>Equivalent to its
   * uppercase counterpart.
   *
   */
  camera_info_serial_number: 'serial-number',
  /**
   * String literal of <code>'firmware-version'</code>. <br>Primary firmware version.
   * <br>Equivalent to its uppercase counterpart.
   */
  camera_info_firmware_version: 'firmware-version',
  /**
   * String literal of <code>'port'</code>. <br>Unique identifier of the port the device is
   * connected to (platform specific). <br>Equivalent to its uppercase counterpart.
   *
   */
  camera_info_physical_port: 'physical-port',
  /**
   * String literal of <code>'debug-op-code'</code>. <br>If device supports firmware logging,
   * this is the command to send to get logs from firmware. <br>Equivalent to its uppercase
   * counterpart.
   */
  camera_info_debug_op_code: 'debug-op-code',
  /**
   * String literal of <code>'advanced-mode'</code>. <br>True iff the device is in advanced
   * mode. <br>Equivalent to its uppercase counterpart.
   *
   */
  camera_info_advanced_mode: 'advanced-mode',
  /**
   * String literal of <code>'product-id'</code>. <br>Product ID as reported in the USB
   * descriptor. <br>Equivalent to its uppercase counterpart.
   *
   */
  camera_info_product_id: 'product-id',
  /**
   * String literal of <code>'camera-locked'</code>. <br>True if EEPROM is locked.
   * <br>Equivalent to its uppercase counterpart.
   */
  camera_info_camera_locked: 'camera-locked',

  /**
   * Device friendly name. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_NAME: RS2.RS2_CAMERA_INFO_NAME,
  /**
   * Device serial number. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_SERIAL_NUMBER: RS2.RS2_CAMERA_INFO_SERIAL_NUMBER,
  /**
   * Primary firmware version. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_FIRMWARE_VERSION: RS2.RS2_CAMERA_INFO_FIRMWARE_VERSION,
  /**
   * Unique identifier of the port the device is connected to (platform specific). <br>Equivalent to
   * its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_PHYSICAL_PORT: RS2.RS2_CAMERA_INFO_PHYSICAL_PORT,
  /**
   * If device supports firmware logging, this is the command to send to get logs from firmware.
   * <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_DEBUG_OP_CODE: RS2.RS2_CAMERA_INFO_DEBUG_OP_CODE,
  /**
   * True iff the device is in advanced mode. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_ADVANCED_MODE: RS2.RS2_CAMERA_INFO_ADVANCED_MODE,
  /**
   * Product ID as reported in the USB descriptor. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_PRODUCT_ID: RS2.RS2_CAMERA_INFO_PRODUCT_ID,
  /**
   * True if EEPROM is locked. <br>Equivalent to its lowercase counterpart.
   * @type {Integer}
   */
  CAMERA_INFO_CAMERA_LOCKED: RS2.RS2_CAMERA_INFO_CAMERA_LOCKED,

  /**
   * Number of enumeration values. Not a valid input: intended to be used in for-loops.
   * @type {Integer}
   */
  CAMERA_INFO_COUNT: RS2.RS2_CAMERA_INFO_COUNT,

  /**
   * Get the string representation out of the integer camera_info type
   * @param {Integer} info the camera_info type
   * @return {String}
   */
  cameraInfoToString: function(info) {
    if (arguments.length !== 1) {
      throw new TypeError('camera_info.cameraInfoToString(info) expects 1 argument');
    } else {
      let i = checkStringNumber(arguments[0],
          this.CAMERA_INFO_NAME, this.CAMERA_INFO_COUNT,
          cameraInfo2Int,
          'camera_info.cameraInfoToString(info) expects a number or string as the 1st argument',
          'camera_info.cameraInfoToString(info) expects a valid value as the 1st argument');
      switch (i) {
        case this.CAMERA_INFO_NAME:
          return this.camera_info_name;
        case this.CAMERA_INFO_SERIAL_NUMBER:
          return this.camera_info_serial_number;
        case this.CAMERA_INFO_FIRMWARE_VERSION:
          return this.camera_info_firmware_version;
        case this.CAMERA_INFO_PHYSICAL_PORT:
          return this.camera_info_physical_port;
        case this.CAMERA_INFO_DEBUG_OP_CODE:
          return this.camera_info_debug_op_code;
        case this.CAMERA_INFO_ADVANCED_MODE:
          return this.camera_info_advanced_mode;
        case this.CAMERA_INFO_PRODUCT_ID:
          return this.camera_info_product_id;
        case this.CAMERA_INFO_CAMERA_LOCKED:
          return this.camera_info_camera_locked;
      }
    }
  },
};

/**
 * Enum for frame metadata types
 * @readonly
 * @enum {String}
 * @see [Frame.supportsFrameMetadata()]{@link Frame#supportsFrameMetadata}
 */
const frame_metadata = {
    /**
     * String literal of <code>'frame-counter'</code>. <br>A sequential index managed
     * per-stream. Integer value <br>Equivalent to its uppercase counterpart
     */
    frame_metadata_frame_counter: 'frame-counter',
    /**
     * String literal of <code>'frame-timestamp'</code>. <br>Timestamp set by device
     * clock when data readout and transmit commence. usec <br>Equivalent to its uppercase
     * counterpart
     */
    frame_metadata_frame_timestamp: 'frame-timestamp',
    /**
     * String literal of <code>'sensor-timestamp'</code>. <br>Timestamp of the middle
     * of sensor's exposure calculated by device. usec <br>Equivalent to its uppercase counterpart
     */
    frame_metadata_sensor_timestamp: 'sensor-timestamp',
    /**
     * String literal of <code>'actual-exposure'</code>. <br>Sensor's exposure width.
     * When Auto Exposure (AE) is on the value is controlled by firmware. usec <br>Equivalent to
     * its uppercase counterpart
     */
    frame_metadata_actual_exposure: 'actual-exposure',
    /**
     * String literal of <code>'gain-level'</code>. <br>A relative value increasing
     * which will increase the Sensor's gain factor. When AE is set On, the value is controlled by
     * firmware. Integer value <br>Equivalent to its uppercase counterpart
     */
    frame_metadata_gain_level: 'gain-level',
    /**
     * String literal of <code>'auto-exposure'</code>. <br>Auto Exposure Mode
     * indicator. Zero corresponds to AE switched off.  <br>Equivalent to its uppercase counterpart
     */
    frame_metadata_auto_exposure: 'auto-exposure',
    /**
     * String literal of <code>'white-balance'</code>. <br>White Balance setting as a
     * color temperature. Kelvin degrees <br>Equivalent to its uppercase counterpart
     */
    frame_metadata_white_balance: 'white-balance',
    /**
     * String literal of <code>'time-of-arrival'</code>. <br>Time of arrival in
     * system clock  <br>Equivalent to its uppercase counterpart
     */
    frame_metadata_time_of_arrival: 'time-of-arrival',
    /**
     * A sequential index managed per-stream. Integer value <br>Equivalent to its lowercase
     * counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_FRAME_COUNTER: RS2.RS2_FRAME_METADATA_FRAME_COUNTER,
    /**
     * Timestamp set by device clock when data readout and transmit commence. usec <br>Equivalent
     * to its lowercase counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_FRAME_TIMESTAMP: RS2.RS2_FRAME_METADATA_FRAME_TIMESTAMP,
    /**
     * Timestamp of the middle of sensor's exposure calculated by device. usec <br>Equivalent to
     * its lowercase counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_SENSOR_TIMESTAMP: RS2.RS2_FRAME_METADATA_SENSOR_TIMESTAMP,
    /**
     * Sensor's exposure width. When Auto Exposure (AE) is on the value is controlled by
     * firmware. usec <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_ACTUAL_EXPOSURE: RS2.RS2_FRAME_METADATA_ACTUAL_EXPOSURE,
    /**
     * A relative value increasing which will increase the Sensor's gain factor. When AE is set
     * On, the value is controlled by firmware. Integer value <br>Equivalent to its lowercase
     * counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_GAIN_LEVEL: RS2.RS2_FRAME_METADATA_GAIN_LEVEL,
    /**
     * Auto Exposure Mode indicator. Zero corresponds to AE switched off.  <br>Equivalent to its
     * lowercase counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_AUTO_EXPOSURE: RS2.RS2_FRAME_METADATA_AUTO_EXPOSURE,
    /**
     * White Balance setting as a color temperature. Kelvin degrees <br>Equivalent to its lowercase
     * counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_WHITE_BALANCE: RS2.RS2_FRAME_METADATA_WHITE_BALANCE,
    /**
     * Time of arrival in system clock  <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    FRAME_METADATA_TIME_OF_ARRIVAL: RS2.RS2_FRAME_METADATA_TIME_OF_ARRIVAL,
    /**
     * Number of enumeration values. Not a valid input: intended to be used in for-loops.
     * @type {Integer}
     */
    FRAME_METADATA_COUNT: RS2.RS2_FRAME_METADATA_COUNT,

    /**
     * Get the string representation out of the integer frame metadata type
     * @param {Integer} metadata the frame metadata type
     * @return {String}
     */
    frameMetadataToString: function(metadata) {
      if (arguments.length !== 1) {
        throw new TypeError('frame_metadata.frameMetadataToString() expects 1 argument');
      } else {
        let i = checkStringNumber(arguments[0],
            this.FRAME_METADATA_FRAME_COUNTER, this.FRAME_METADATA_COUNT,
            frameMetadata2Int,
            'frame_metadata.frameMetadataToString() expects a number or string as the 1st argument',
            'frame_metadata.frameMetadataToString() expects a valid value as the 1st argument');
        switch (i) {
          case this.FRAME_METADATA_FRAME_COUNTER:
            return this.frame_metadata_frame_counter;
          case this.FRAME_METADATA_FRAME_TIMESTAMP:
            return this.frame_metadata_frame_timestamp;
          case this.FRAME_METADATA_SENSOR_TIMESTAMP:
            return this.frame_metadata_sensor_timestamp;
          case this.FRAME_METADATA_ACTUAL_EXPOSURE:
            return this.frame_metadata_actual_exposure;
          case this.FRAME_METADATA_GAIN_LEVEL:
            return this.frame_metadata_gain_level;
          case this.FRAME_METADATA_AUTO_EXPOSURE:
            return this.frame_metadata_auto_exposure;
          case this.FRAME_METADATA_WHITE_BALANCE:
            return this.frame_metadata_white_balance;
          case this.FRAME_METADATA_TIME_OF_ARRIVAL:
            return this.frame_metadata_time_of_arrival;
        }
      }
    },
  };

/**
 * Enum for distortion types
 * @readonly
 * @enum {String}
 */
const distortion = {
    /**
     * String literal of <code>'none'</code>. <br>Rectilinear images. No distortion compensation
     * required. <br> Equivalent to its uppercase counterpart.
     */
    distortion_none: 'none',
    /**
     * String literal of <code>'modified-brown-conrady'</code>. <br>Equivalent to Brown-Conrady
     * distortion, except that tangential distortion is applied to radially distorted points
     * <br> Equivalent to its uppercase counterpart.
     */
    distortion_modified_brown_conrady: 'modified-brown-conrady',
    /**
     * String literal of <code>'inverse-brown-conrady'</code>. <br>Equivalent to Brown-Conrady
     * distortion, except undistorts image instead of distorting it
     * <br> Equivalent to its uppercase counterpart.
     */
    distortion_inverse_brown_conrady: 'inverse-brown-conrady',
    /**
     * String literal of <code>'ftheta'</code>. <br>F-Theta fish-eye distortion model
     * <br>Equivalent to its uppercase counterpart.
     */
    distortion_ftheta: 'ftheta',
    /**
     * String literal of <code>'brown-conrady'</code>. <br>Unmodified Brown-Conrady distortion
     * model <br> Equivalent to its uppercase counterpart.
     */
    distortion_brown_conrady: 'brown-conrady',

    /** Rectilinear images. No distortion compensation required. <br>Equivalent to its lowercase
     * counterpart
     * @type {Integer}
     */
    DISTORTION_NONE: RS2.RS2_DISTORTION_NONE,
    /** Equivalent to Brown-Conrady distortion, except that tangential distortion is applied to
     * radially distorted points <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    DISTORTION_MODIFIED_BROWN_CONRADY: RS2.RS2_DISTORTION_MODIFIED_BROWN_CONRADY,
    /** Equivalent to Brown-Conrady distortion, except undistorts image instead of distorting it
     * <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    DISTORTION_INVERSE_BROWN_CONRADY: RS2.RS2_DISTORTION_INVERSE_BROWN_CONRADY,
    /** F-Theta fish-eye distortion model <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    DISTORTION_FTHETA: RS2.RS2_DISTORTION_FTHETA,
    /** Unmodified Brown-Conrady distortion model <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    DISTORTION_BROWN_CONRADY: RS2.RS2_DISTORTION_BROWN_CONRADY,
    /**
     * Number of enumeration values. Not a valid input: intended to be used in for-loops.
     * @type {Integer}
     */
    DISTORTION_COUNT: RS2.RS2_DISTORTION_COUNT,

    /**
     * Get the string representation out of the integer distortion type
     * @param {Integer} distortionVal the distortion type
     * @return {String}
     */
    distortionToString: function(distortionVal) {
      if (arguments.length !== 1) {
        throw new TypeError('distortion.distortionToString() expects 1 argument');
      } else {
        let i = checkStringNumber(arguments[0],
            this.DISTORTION_NONE, this.DISTORTION_COUNT,
            distortion2Int,
            'distortion.distortionToString() expects a number or string as the 1st argument',
            'distortion.distortionToString() expects a valid value as the 1st argument');
        switch (i) {
          case this.DISTORTION_NONE:
            return this.distortion_none;
          case this.DISTORTION_MODIFIED_BROWN_CONRADY:
            return this.distortion_modified_brown_conrady;
          case this.DISTORTION_INVERSE_BROWN_CONRADY:
            return this.distortion_inverse_brown_conrady;
          case this.DISTORTION_FTHETA:
            return this.distortion_ftheta;
          case this.DISTORTION_BROWN_CONRADY:
            return this.distortion_brown_conrady;
        }
      }
    },
};

/**
 * Enum for notification severity
 * @readonly
 * @enum {String}
 */
const log_severity = {
    /**
     * String literal of <code>'debug'</code>. <br>Detailed information about ordinary operations.
     * <br>Equivalent to its uppercase counterpart.
     */
    log_severity_debug: 'debug',
    /**
     * String literal of <code>'info'</code>. <br>Terse information about ordinary operations.
     * <br>Equivalent to its uppercase counterpart.
     */
    log_severity_info: 'info',
    /**
     * String literal of <code>'warn'</code>. <br>Indication of possible failure.
     * <br>Equivalent to its uppercase counterpart.
     */
    log_severity_warn: 'warn',
    /**
     * String literal of <code>'error'</code>. <br>Indication of definite failure.
     * <br>Equivalent to its uppercase counterpart.
     */
    log_severity_error: 'error',
    /**
     * String literal of <code>'fatal'</code>. <br>Indication of unrecoverable failure.
     * <br>Equivalent to its uppercase counterpart.
     */
    log_severity_fatal: 'fatal',
    /**
     * String literal of <code>'none'</code>. <br>No logging will occur.
     * <br>Equivalent to its uppercase counterpart.
     */
    log_severity_none: 'none',

    /**
     * Detailed information about ordinary operations. <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    LOG_SEVERITY_DEBUG: RS2.RS2_LOG_SEVERITY_DEBUG,
    /**
     * Terse information about ordinary operations. <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    LOG_SEVERITY_INFO: RS2.RS2_LOG_SEVERITY_INFO,
    /**
     * Indication of possible failure. <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    LOG_SEVERITY_WARN: RS2.RS2_LOG_SEVERITY_WARN,
    /**
     * Indication of definite failure. <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    LOG_SEVERITY_ERROR: RS2.RS2_LOG_SEVERITY_ERROR,
    /**
     * Indication of unrecoverable failure. <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    LOG_SEVERITY_FATAL: RS2.RS2_LOG_SEVERITY_FATAL,
    /**
     * No logging will occur. <br>Equivalent to its lowercase counterpart.
     * @type {Integer}
     */
    LOG_SEVERITY_NONE: RS2.RS2_LOG_SEVERITY_NONE,
};

/**
 * Enum for notification category
 * @readonly
 * @enum {String}
 */
const notification_category = {
    /**
     * String literal of <code>'frames-timeout'</code>. <br>Frames didn't arrived within 5 seconds
     * <br>Equivalent to its uppercase counterpart.
     */
    notification_category_frames_timeout: 'frames-timeout',
    /**
     * String literal of <code>'frame-corrupted'</code>. <br>Received partial/incomplete frame
     * <br>Equivalent to its uppercase counterpart.
     */
    notification_category_frame_corrupted: 'frame-corrupted',
    /**
     * String literal of <code>'hardware-error'</code>. <br>Error reported from the device
     * <br>Equivalent to its uppercase counterpart.
     */
    notification_category_hardware_error: 'hardware-error',
    /**
     * String literal of <code>'unknown-error'</code>. <br>Received unknown error from the device
     * <br>Equivalent to its uppercase counterpart.
     */
    notification_category_unknown_error: 'unknown-error',

    /**
     * Frames didn't arrived within 5 seconds <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    NOTIFICATION_CATEGORY_FRAMES_TIMEOUT: RS2.RS2_NOTIFICATION_CATEGORY_FRAMES_TIMEOUT,
    /**
     * Received partial/incomplete frame <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    NOTIFICATION_CATEGORY_FRAME_CORRUPTED: RS2.RS2_NOTIFICATION_CATEGORY_FRAME_CORRUPTED,
    /**
     * Error reported from the device <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    NOTIFICATION_CATEGORY_HARDWARE_ERROR: RS2.RS2_NOTIFICATION_CATEGORY_HARDWARE_ERROR,
    /**
     * Received unknown error from the device <br>Equivalent to its lowercase counterpart
     * @type {Integer}
     */
    NOTIFICATION_CATEGORY_UNKNOWN_ERROR: RS2.RS2_NOTIFICATION_CATEGORY_UNKNOWN_ERROR,
};

/**
 * Enum for timestamp domain.
 * @readonly
 * @enum {String}
 */
const timestamp_domain = {
    /**
     * String literal of <code>'hardware-clock'</code>. <br>Frame timestamp was measured in
     * relation to the camera clock <br>Equivalent to its uppercase counterpart.
     */
    timestamp_domain_hardware_clock: 'hardware-clock',
    /**
     * String literal of <code>'system-time'</code>. <br>Frame timestamp was measured in relation
     * to the OS system clock <br>Equivalent to its uppercase counterpart.
     */
    timestamp_domain_system_time: 'system-time',

    /**
     * Frame timestamp was measured in relation to the camera clock <br>Equivalent to its lowercase
     * counterpart.
     * @type {Integer}
     */
    TIMESTAMP_DOMAIN_HARDWARE_CLOCK: RS2.RS2_TIMESTAMP_DOMAIN_HARDWARE_CLOCK,
    /**
     * Frame timestamp was measured in relation to the OS system clock <br>Equivalent to its
     * lowercase counterpart.
     * @type {Integer}
     */
    TIMESTAMP_DOMAIN_SYSTEM_TIME: RS2.RS2_TIMESTAMP_DOMAIN_SYSTEM_TIME,
    /**
     * Number of enumeration values. Not a valid input: intended to be used in for-loops.
     * @type {Integer}
     */
    TIMESTAMP_DOMAIN_COUNT: RS2.RS2_TIMESTAMP_DOMAIN_COUNT,
    /**
     * Get the string representation out of the integer timestamp_domain type
     * @param {Integer} domainVal the timestamp_domain type
     * @return {String}
     */
    timestampDomainToString: function(domainVal) {
      if (arguments.length !== 1) {
        throw new TypeError('timestamp_domain.timestampDomainToString() expects 1 argument');
      }
      let i = checkStringNumber(arguments[0],
          this.TIMESTAMP_DOMAIN_HARDWARE_CLOCK, this.TIMESTAMP_DOMAIN_COUNT,
          timestampDomain2Int,
          'timestamp_domain.timestampDomainToString() expects a number or string as the 1st argument', // eslint-disable-line
          'timestamp_domain.timestampDomainToString() expects a valid value as the 1st argument');
      switch (i) {
        case this.TIMESTAMP_DOMAIN_HARDWARE_CLOCK:
          return this.timestamp_domain_hardware_clock;
        case this.TIMESTAMP_DOMAIN_SYSTEM_TIME:
          return this.timestamp_domain_system_time;
        default:
          throw new TypeError('timestamp_domain.timestampDomainToString() expects a valid value as the 1st argument'); // eslint-disable-line
      }
    },
};

/**
 * Enum for visual preset
 * @readonly
 * @enum {String}
 */
const visual_preset = {
  /**
   * String literal of <code>'short-range'</code>. <br>Preset for short range.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_short_range: 'short-range',
  /**
   * String literal of <code>'long-range'</code>. <br>Preset for long range.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_long_range: 'long-range',
  /**
   * String literal of <code>'background-segmentation'</code>. <br>Preset for background
   * segmentation.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_background_segmentation: 'background-segmentation',
  /**
   * String literal of <code>'gesture-recognition'</code>. <br>Preset for gesture recognition.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_gesture_recognition: 'gesture-recognition',
  /**
   * String literal of <code>'object-scanning'</code>. <br>Preset for object scanning.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_object_scanning: 'object-scanning',
  /**
   * String literal of <code>'face-analytics'</code>. <br>Preset for face analytics.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_face_analytics: 'face-analytics',
  /**
   * String literal of <code>'face-login'</code>. <br>Preset for face login.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_face_login: 'face-login',
  /**
   * String literal of <code>'gr-cursor'</code>. <br>Preset for GR cursor.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_gr_cursor: 'gr-cursor',
  /**
   * String literal of <code>'default'</code>. <br>Preset for default.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_default: 'default',
  /**
   * String literal of <code>'mid-range'</code>. <br>Preset for mid-range.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_mid_range: 'mid-range',
  /**
   * String literal of <code>'ir-only'</code>. <br>Preset for IR only.
   * <br>Equivalent to its uppercase counterpart
   */
  visual_preset_ir_only: 'ir-only',

  /**
   * Preset for short range
   * @type {Integer}
   */
  VISUAL_PRESET_SHORT_RANGE: RS2.RS2_VISUAL_PRESET_SHORT_RANGE,
  /**
   * Preset for long range
   * @type {Integer}
   */
  VISUAL_PRESET_LONG_RANGE: RS2.RS2_VISUAL_PRESET_LONG_RANGE,
  /**
   * Preset for background segmentation
   * @type {Integer}
   */
  VISUAL_PRESET_BACKGROUND_SEGMENTATION: RS2.RS2_VISUAL_PRESET_BACKGROUND_SEGMENTATION,
  /**
   * Preset for gesture recognition
   * @type {Integer}
   */
  VISUAL_PRESET_GESTURE_RECOGNITION: RS2.RS2_VISUAL_PRESET_GESTURE_RECOGNITION,
  /**
   * Preset for object scanning
   * @type {Integer}
   */
  VISUAL_PRESET_OBJECT_SCANNING: RS2.RS2_VISUAL_PRESET_OBJECT_SCANNING,
  /**
   * Preset for face analytics
   * @type {Integer}
   */
  VISUAL_PRESET_FACE_ANALYTICS: RS2.RS2_VISUAL_PRESET_FACE_ANALYTICS,
  /**
   * Preset for face login
   * @type {Integer}
   */
  VISUAL_PRESET_FACE_LOGIN: RS2.RS2_VISUAL_PRESET_FACE_LOGIN,
  /**
   * Preset for GR cursor
   * @type {Integer}
   */
  VISUAL_PRESET_GR_CURSOR: RS2.RS2_VISUAL_PRESET_GR_CURSOR,
  /**
   * Preset for default
   * @type {Integer}
   */
  VISUAL_PRESET_DEFAULT: RS2.RS2_VISUAL_PRESET_DEFAULT,
  /**
   * Preset for mid-range
   * @type {Integer}
   */
  VISUAL_PRESET_MID_RANGE: RS2.RS2_VISUAL_PRESET_MID_RANGE,
  /**
   * Preset for IR only
   * @type {Integer}
   */
  VISUAL_PRESET_IR_ONLY: RS2.RS2_VISUAL_PRESET_IR_ONLY,
  /**
   * Number of enumeration values. Not a valid input: intended to be used in for-loops.
   * @type {Integer}
   */
  VISUAL_PRESET_COUNT: RS2.RS2_VISUAL_PRESET_COUNT,
};

// e.g. str2Int('enable_motion_correction', 'option')
function str2Int(str, category) {
  const name = 'RS2_' + category.toUpperCase() + '_' + str.toUpperCase().replace(/-/g, '_');
  return RS2[name];
}

function stream2Int(str) {
 return str2Int(str, 'stream');
}
function format2Int(str) {
 return str2Int(str, 'format');
}
function option2Int(str) {
 return str2Int(str, 'option');
}
function cameraInfo2Int(str) {
 return str2Int(str, 'camera_info');
}
function recordingMode2Int(str) {
 return str2Int(str, 'recording_mode');
}
function timestampDomain2Int(str) {
 return str2Int(str, 'timestamp_domain');
}
function NotificationCategory2Int(str) {
 return str2Int(str, 'notification_category');
}
function logSeverity2Int(str) {
 return str2Int(str, 'log_severity');
}
function distortion2Int(str) {
 return str2Int(str, 'distortion');
}
function frameMetadata2Int(str) {
 return str2Int(str, 'frame_metadata');
}
function visualPreset2Int(str) {
 return str2Int(str, 'visual_preset');
}

function isArrayBuffer(value) {
    return value && value instanceof ArrayBuffer && value.byteLength !== undefined;
}

const constants = {
  stream: stream,
  format: format,
  option: option,
  camera_info: camera_info,
  recording_mode: recording_mode,
  timestamp_domain: timestamp_domain,
  notification_category: notification_category,
  log_severity: log_severity,
  distortion: distortion,
  frame_metadata: frame_metadata,
  visual_preset: visual_preset,
};

function cleanup() {
  internal.cleanup();
  RS2.globalCleanup();
}

module.exports = {
  cleanup: cleanup,

  Context: Context,
  Pipeline: Pipeline,
  PipelineProfile: PipelineProfile,
  Config: Config,
  Colorizer: Colorizer,
  Device: Device,
  DeviceList: DeviceList,
  DeviceHub: DeviceHub,
  Sensor: Sensor,
  DepthSensor: DepthSensor,
  ROISensor: ROISensor,
  StreamProfile: StreamProfile,
  VideoStreamProfile: VideoStreamProfile,
  Frame: Frame,
  FrameSet: FrameSet,
  VideoFrame: VideoFrame,
  DepthFrame: DepthFrame,
  Align: Align,
  PointCloud: PointCloud,
  Points: Points,
  // PlaybackContext: PlaybackContext,
  // RecordingContext: RecordingContext,
  Syncer: Syncer,

  stream: stream,
  format: format,
  option: option,
  camera_info: camera_info,
  recording_mode: recording_mode,
  timestamp_domain: timestamp_domain,
  notification_category: notification_category,
  log_severity: log_severity,
  distortion: distortion,
  frame_metadata: frame_metadata,
  visual_preset: visual_preset,

  util: util,

  stringConstantToIntegerValue: str2Int,
};
