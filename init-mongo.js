// init-mongo.js
db = db.getSiblingDB('devicerental');
db.devices.drop();
db.devices.createCollection('devices');
db.devices.insertMany([
  { 
    serialNumber: "SN001",
    deviceInfo: "Galaxy S21",
    osName: "Android",
    osVersion: "Android 13",
    modelName: "Galaxy S21",
    status: "active",
    rentedBy: null,
    rentedAt: null,
    remark: "",
    specialRemark: ""
  },
  { 
    serialNumber: "SN002",
    deviceInfo: "iPad Pro",
    osName: "iOS",
    osVersion: "iOS 17.4",
    modelName: "iPad Pro",
    status: "active",
    rentedBy: null,
    rentedAt: null,
    remark: "",
    specialRemark: ""
  }
]);