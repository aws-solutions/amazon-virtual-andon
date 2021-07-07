/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createSite = `mutation CreateSite($id: ID, $name: String!, $description: String!, $__typename: String!) {
  createSite(id: $id, name: $name, description: $description, __typename: $__typename) {
    id
    name
    description
    version
  }
}`;
export const deleteSite = `mutation DeleteSite($siteId: ID!) {
  deleteSite(id: $siteId) {
    id
  }
}`;
export const createArea = `mutation CreateArea($id: ID, $areaSiteId: ID!, $name: String!, $description: String!, $__typename: String!) {
  createArea(id: $id, areaSiteId: $areaSiteId, name: $name, description: $description, __typename: $__typename) {
    id
    name
    description
    version
  }
}`;
export const deleteArea = `mutation DeleteArea($areaId: ID!) {
  deleteArea(id: $areaId) {
    id
  }
}`;
export const createProcess = `mutation CreateProcess($id: ID, $processAreaId: ID!, $name: String!, $description: String!, $__typename: String!) {
  createProcess(id: $id, processAreaId: $processAreaId, name: $name, description: $description, __typename: $__typename) {
    id
    name
    description
    version
  }
}`;
export const deleteProcess = `mutation DeleteProcess($processId: ID!) {
  deleteProcess(id: $processId) {
    id
  }
}
`;
export const createEvent = `mutation CreateEvent(
    $id: ID,
    $eventProcessId: ID!,
    $name: String!,
    $description: String!,
    $__typename: String!,
    $type: String,
    $priority: Priority!,
    $sms: String,
    $email: String,
    $topicArn: String,
    $rootCauses: [String],
    $eventImgKey: String
  ) {
  createEvent(
    id: $id,
    eventProcessId: $eventProcessId,
    name: $name,
    description: $description,
    __typename: $__typename,
    type: $type,
    priority: $priority,
    sms: $sms,
    email: $email,
    topicArn: $topicArn,
    rootCauses: $rootCauses,
    eventImgKey: $eventImgKey
  ) {
    id
    name
    description
    type
    priority
    sms
    email
    topicArn
    rootCauses
    version
    eventImgKey
  }
}`;
export const updateEvent = `mutation UpdateEvent(
    $id: ID!,
    $sms: String,
    $email: String,
    $topicArn: String,
    $rootCauses: [String],
    $eventImgKey: String
  ) {
    updateEvent(
    id: $id,
    sms: $sms,
    email: $email,
    topicArn: $topicArn,
    rootCauses: $rootCauses,
    eventImgKey: $eventImgKey
  ) {
    id
    name
    description
    type
    priority
    sms
    email
    topicArn
    rootCauses
    version
    eventImgKey
  }
}`;
export const deleteEvent = `mutation DeleteEvent($eventId: ID!) {
  deleteEvent(id: $eventId) {
    id
    topicArn
  }
}`;
export const createStation = `mutation CreateStation($id: ID, $stationAreaId: ID!, $name: String!, $description: String!, $__typename: String!) {
  createStation(id: $id, stationAreaId: $stationAreaId, name: $name, description: $description, __typename: $__typename) {
    id
    name
    description
    version
  }
}`;
export const deleteStation = `mutation DeleteStation($stationId: ID!) {
  deleteStation(id: $stationId) {
    id
  }
}`;
export const createDevice = `mutation CreateDevice($id: ID, $deviceStationId: ID!, $name: String!, $description: String!, $__typename: String!) {
  createDevice(id: $id, deviceStationId: $deviceStationId, name: $name, description: $description, __typename: $__typename) {
    id
    name
    description
    version
  }
}`;
export const deleteDevice = `mutation DeleteDevice($deviceId: ID!) {
  deleteDevice(id: $deviceId) {
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
    userId
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
export const deletePermission = `mutation DeletePermission($userId: ID!) {
  deletePermission(userId: $userId) {
    userId
  }
}`;
export const createRootCause = `mutation CreateRootCause($id: ID, $rootCause: String!) {
  createRootCause(id: $id, rootCause: $rootCause) {
    id
    rootCause
  }
}`;
export const deleteRootCause = `mutation DeleteRootCause($id: ID!) {
  deleteRootCause(id: $id) {
    id
    rootCause
  }
}`;