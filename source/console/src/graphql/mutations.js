// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable */

export const createSite = `mutation CreateSite($id: ID, $name: String!, $description: String!) {
  createSite(id: $id, type: "SITE", name: $name, description: $description) {
    id
    name
    description
    version
  }
}`;
export const deleteSite = `mutation DeleteSite($siteId: ID!) {
  deleteSite(id: $siteId, type: "SITE") {
    id
  }
}`;
export const createArea = `mutation CreateArea($id: ID, $areaSiteId: ID!, $name: String!, $description: String!) {
  createArea(id: $id, type: "AREA", areaSiteId: $areaSiteId, name: $name, description: $description) {
    id
    name
    description
    version
  }
}`;
export const deleteArea = `mutation DeleteArea($areaId: ID!) {
  deleteArea(id: $areaId, type: "AREA") {
    id
  }
}`;
export const createProcess = `mutation CreateProcess($id: ID, $processAreaId: ID!, $name: String!, $description: String!) {
  createProcess(id: $id, type: "PROCESS", processAreaId: $processAreaId, name: $name, description: $description) {
    id
    name
    description
    version
  }
}`;
export const deleteProcess = `mutation DeleteProcess($processId: ID!) {
  deleteProcess(id: $processId, type: "PROCESS") {
    id
  }
}
`;
export const createEvent = `mutation CreateEvent(
    $id: ID,
    $eventProcessId: ID,
    $parentId: ID,
    $name: String!,
    $description: String!,
    $priority: Priority!,
    $sms: String,
    $email: String,
    $rootCauses: [String],
    $eventImgKey: String,
    $eventType: String,
    $alias: String,
  ) {
  createEvent(
    id: $id,
    type: "EVENT",
    eventProcessId: $eventProcessId,
    parentId: $parentId,
    name: $name,
    description: $description,
    eventType: $eventType,
    priority: $priority,
    sms: $sms,
    email: $email,
    rootCauses: $rootCauses,
    eventImgKey: $eventImgKey
    alias: $alias
  ) {
    id
    name
    description
    priority
    sms
    email
    rootCauses
    version
    eventImgKey
    eventType,
    alias,
    eventProcessId,
    parentId
  }
}`;
export const updateEvent = `mutation UpdateEvent(
    $id: ID!,
    $sms: String,
    $email: String,
    $previousSms: String,
    $previousEmail: String,
    $rootCauses: [String],
    $eventImgKey: String,
    $alias: String
  ) {
    updateEvent(
    id: $id,
    sms: $sms,
    email: $email,
    previousSms: $previousSms,
    previousEmail: $previousEmail,
    rootCauses: $rootCauses,
    eventImgKey: $eventImgKey,
    alias: $alias
  ) {
    id
    name
    description
    type
    priority
    sms
    email
    rootCauses
    version
    eventImgKey
    alias
  }
}`;
export const deleteEvent = `mutation DeleteEvent($eventId: ID!) {
  deleteEvent(id: $eventId, type: "EVENT") {
    id
  }
}`;
export const createStation = `mutation CreateStation($id: ID, $stationAreaId: ID!, $name: String!, $description: String!) {
  createStation(id: $id, type: "STATION", stationAreaId: $stationAreaId, name: $name, description: $description) {
    id
    name
    description
    version
  }
}`;
export const deleteStation = `mutation DeleteStation($stationId: ID!) {
  deleteStation(id: $stationId, type: "STATION") {
    id
  }
}`;
export const createDevice = `mutation CreateDevice($id: ID, $deviceStationId: ID!, $name: String!, $description: String!, $alias: String) {
  createDevice(id: $id, type: "DEVICE", deviceStationId: $deviceStationId, name: $name, description: $description, alias: $alias) {
    id
    name
    description
    version
    alias
  }
}`;
export const deleteDevice = `mutation DeleteDevice($deviceId: ID!) {
  deleteDevice(id: $deviceId, type: "DEVICE") {
    id
  }
}`;
export const updateIssue = `mutation UpdateIssue($input: UpdateIssueInput!) {
  updateIssue(input: $input) {
    id
    eventId
    eventDescription
    type
    priority
    siteName
    processName
    areaName
    stationName
    deviceName
    created
    createdAt
    acknowledged
    closed
    resolutionTime
    acknowledgedTime
    status
    version
    rootCause
    comment
  }
}`;
export const putPermission = `mutation PutPermission($input: PermissionInput!) {
  putPermission(input: $input) {
    id
    sites {
      id
      name
    }
    areas  {
      id
      name
      parentId
    }
    processes  {
      id
      name
      parentId
    }
    stations  {
      id
      name
      parentId
    }
    devices  {
      id
      name
      parentId
    }
    version
  }
}`;
export const deletePermission = `mutation DeletePermission($id: ID!) {
  deletePermission(id: $id, type: "PERMISSION") {
    id
  }
}`;
export const createRootCause = `mutation CreateRootCause($id: ID, $rootCause: String!) {
  createRootCause(id: $id, type: "ROOT_CAUSE", name: $rootCause) {
    id
    type
    name
  }
}`;
export const deleteRootCause = `mutation DeleteRootCause($id: ID!) {
  deleteRootCause(id: $id, type: "ROOT_CAUSE") {
    id
    name
  }
}`;