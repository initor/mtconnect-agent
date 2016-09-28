/**
  * Copyright 2016, System Insights, Inc.
  *
  * Licensed under the Apache License, Version 2.0 (the "License");
  * you may not use this file except in compliance with the License.
  * You may obtain a copy of the License at
  *
  *    http://www.apache.org/licenses/LICENSE-2.0
  *
  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
  */

// Imports - External

const xpath = require('xpath');
const Dom = require('xmldom').DOMParser;
const fs = require('fs');
const path = require('path');
const xsd = require('libxml-xsd');
const moment = require('moment');
const tmp = require('tmp');
const defaultShell = require('child_process');

// Imports - Internal

const log = require('./config/logger');
const lokijs = require('./lokijs');
const dataStorage = require('./dataStorage');
const R = require('ramda');

// Functions

function getCategory(id, uuid) {
  let dataItems = lokijs.getDataItem(uuid);
  let category = '';
  if (dataItems) {
    R.find((k) => {
      if (k.$.id === id || k.$.name === id) {
        category = k.$.category;
      }
    }, dataItems)
    return category;
  }
  log.error('Error: getDataItem is empty');
  return;
}

/**
  * inputParsing get the data from adapter, do string parsing
  * @param {string} inputParsing
  *
  * returns jsonData with time and dataitem
  */
function inputParsing(inputString, uuid) { // ('2014-08-11T08:32:54.028533Z|avail|AVAILABLE')
  let inputParse = inputString.split('|');
  const jsonData = {
    time: inputParse[0],
    dataitem: [],
  };
  let dataItemId = inputParse[1];
  let category = getCategory(dataItemId, uuid);
  if (category === 'CONDITION') {
      // let index = inputString.indexOf('|');
      // let newString = inputString.slice(index + 1);
      // let index2 = newString.indexOf('|');
      // newString = newString.slice(index2 + 1);
      let value = inputParse.slice(2,Infinity);
      jsonData.dataitem.push({ name: inputParse[1], value });
  } else {
    // inputParse = inputString.split('|');
    const totalDataItem = (inputParse.length - 1) / 2;
    for (let i = 0, j = 1; i < totalDataItem; i++, j += 2) {
      // dataitem[i] = { name: (avail), value: (AVAILABLE) };
      jsonData.dataitem.push({ name: inputParse[j], value: inputParse[j + 1] });
    }
  }
  return jsonData;
}

/**
  * getAllDeviceUuids() returns the UUID
  *
  * @param {Object} devices - database of devices connected
  * return uuidSet - array containing all uuids.
  */
function getAllDeviceUuids(devices) {
  const setOfDevice = devices.data;
  const uuidSet = [];
  for (let i = 0; i < setOfDevice.length; i++) {
    uuidSet[i] = setOfDevice[i].uuid;
  }
  return uuidSet;
}

/**
  * duplicateUuidCheck() checks the device collection for
  * received uuid
  * @param {String} receivedUuid - uuid of new device
  * @param {Object} devices - database
  * return uuidFound - array of entries with same uuid
  */
function duplicateUuidCheck(receivedUuid, devices) {
  const uuidFound = devices.find({ uuid: receivedUuid });
  return uuidFound;
}

/**
  * getDeviceUuid() returns the UUID of the device for the deviceName
  *  @param  {String} deviceName
  *  return uuid
  */
function getDeviceUuid(deviceName) {
  const schemaDB = lokijs.getSchemaDB();
  const schemaList = R.values(schemaDB.data);
  let uuid;
  R.find((k) => {
    if (k.name === deviceName) {
      uuid = k.uuid;
    }
    return uuid;
  }, schemaList);
  return uuid;
}

/**
  * getCurrentTimeInSec()
  * returns the present time in Sec
  */
function getCurrentTimeInSec() {
  return moment().unix(Number);
}

/**
  * processError() logs an error message
  * and exits with status code 1.
  *
  * @param {String} message
  * @param {Boolean} exit
  */
function processError(message, exit) {
  log.error(`Error: ${message}`);

  if (exit) process.exit(1);
}

function getMTConnectVersion(xmlString) {
  let version = '';

  try {
    const doc = new Dom().parseFromString(xmlString);
    const node = xpath.select("//*[local-name(.)='MTConnectDevices']", doc)[0];
    const ns = node.namespaceURI;
    version = ns.split(':').pop();
  } catch (e) {
    log.error('Error: obtaining MTConnect XML namespace', e);
    return null;
  }

  return version;
}

function mtConnectValidate(documentString) {
  let result = '';
  const version = getMTConnectVersion(documentString);
  const deviceXMLFile = tmp.tmpNameSync();

  fs.writeFileSync(deviceXMLFile, documentString, 'utf8', function(err) {
    if (err) {
      log.error('Cannot write documentString to deviceXML file');
      return false;
    }
  });

  if (version) {
    const schemaPath = `../schema/MTConnectDevices_${version}.xsd`;
    const schemaFile = path.join(__dirname, schemaPath);

    const child = defaultShell.spawnSync('xmllint', ['--valid',  '--schema', schemaFile, deviceXMLFile]);
    fs.unlinkSync(deviceXMLFile);

    if (child.stderr.includes("fails to validate") || child.stderr.includes("failed to load external entity")) {
      return false;
    } else { return true; }
  }
  else {
    return false;
  }
}

/**
  * getPathArr creates an array of path parameter for given device collection
  * @param {String} uuidCollection : array of uuid of active devices.
  * returns pathArr: array of path
  */
function getPathArr(uuidCollection) {
  const pathArr = [];
  let i = 0;
  R.map((k) => {
    const dataItemsArr = lokijs.getDataItem(k);

    // create pathArr for all dataItems
    if (dataItemsArr.length !== 0) {
      for (let j = 0; j < dataItemsArr.length; j++) {
        pathArr[i++] = dataItemsArr[j].path;
      }
    }
    return pathArr; // eslint
  }, uuidCollection);
  return pathArr;
}

/**
  * pathValidation() checks whether the received path is a valid XPATH
  * @param recPath - eg: //Axes//Rotary
  * @param uuidCollection - array of uuid of active devices.
  * return true - if path Valid, false - invalid path.
  */
function pathValidation(recPath, uuidCollection) {
  const pathArr = getPathArr(uuidCollection);
  const result = dataStorage.filterPathArr(pathArr, recPath);
  if (result.length !== 0) {
    return true;
  }
  return false;
}
// Exports

module.exports = {
  getDeviceUuid,
  inputParsing,
  processError,
  getAllDeviceUuids,
  getCurrentTimeInSec,
  getMTConnectVersion,
  mtConnectValidate,
  pathValidation,
  duplicateUuidCheck,
};
