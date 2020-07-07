/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const getSite = `query GetSite($id: ID!) {
  getSite(id: $id) {
    id
    name
    area(limit: 50) {
      items {
        id
        name
        description
        version
      }
      nextToken
    }
    description
    version
  }
}
`;
export const listSites = `query ListSites(
  $limit: Int
  $nextToken: String
) {
  listSites(limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      version
    }
    nextToken
  }
}
`;
export const getArea = `query GetArea($id: ID!) {
  getArea(id: $id) {
    id
    site {
      id
      name
      area {
        nextToken
      }
      description
      version
    }
    name
    process(limit: 50) {
      items {
        id
        name
        description
        version
      }
      nextToken
    }
    station(limit: 50) {
      items {
        id
        name
        description
        version
      }
      nextToken
    }
    description
    version
  }
}
`;
export const listAreas = `query ListAreas(
  $areaSiteId: ID!
  $limit: Int
  $nextToken: String
) {
  listAreas(areaSiteId: $areaSiteId, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      version
    }
    nextToken
  }
}`;
export const getProcess = `query GetProcess($id: ID!) {
  getProcess(id: $id) {
    id
    name
    description
    area {
      id
      site {
        id
        name
        description
        version
      }
      name
      process {
        nextToken
      }
      station {
        nextToken
      }
      description
      version
    }
    event(limit: 50) {
      items {
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
      }
      nextToken
    }
    version
  }
}
`;
export const listProcesses = `query ListProcesses(
  $processAreaId: ID!
  $limit: Int
  $nextToken: String
) {
  listProcesses(processAreaId: $processAreaId, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      version
    }
    nextToken
  }
}`;
export const getEvent = `query GetEvent($id: ID!) {
  getEvent(id: $id) {
    id
    name
    description
    process {
      id
      name
      area {
        id
        name
        site {
          id
          name
        }
        process {
          nextToken
        }
        station {
          nextToken
        }
      }
    }
    rootCauses
  }
}
`;
export const listEvents = `query ListEvents(
  $eventProcessId: ID!
  $limit: Int
  $nextToken: String
) {
  listEvents(eventProcessId: $eventProcessId, limit: $limit, nextToken: $nextToken) {
    items {
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
    }
    nextToken
  }
}`;
export const getStation = `query GetStation($id: ID!) {
  getStation(id: $id) {
    id
    name
    description
    area {
      id
      site {
        id
        name
        description
        version
      }
      name
      process {
        nextToken
      }
      station {
        nextToken
      }
      description
      version
    }
    device(limit: 50) {
      items {
        id
        name
        description
        version
      }
      nextToken
    }
    version
  }
}
`;
export const listStations = `query ListStations(
  $stationAreaId: ID!
  $limit: Int
  $nextToken: String
) {
  listStations(stationAreaId: $stationAreaId, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      version
    }
    nextToken
  }
}`
export const listDevices = `query ListDevices(
  $deviceStationId: ID!
  $limit: Int
  $nextToken: String
) {
  listDevices(deviceStationId: $deviceStationId, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      version
    }
    nextToken
  }
}`
export const issuesBySiteAreaStatus = `query IssuesBySiteAreaStatus(
  $siteName: String
  $areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: IssueBySiteAreaStatusCompositeKeyConditionInput
  $filter: IssueFilterInput
  $limit: Int
  $nextToken: String
) {
  issuesBySiteAreaStatus(
    siteName: $siteName
    areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: $areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
      acknowledged
      closed
      resolutionTime
      acknowledgedTime
      status
      version
      rootCause
    }
    nextToken
  }
}
`;
export const issuesByDevice = `query IssuesByDevice(
  $siteName: String
  $areaNameStatusProcessNameStationNameDeviceNameCreated: IssueByDeviceCompositeKeyConditionInput
  $limit: Int
  $nextToken: String
) {
  issuesByDevice(
    siteName: $siteName
    areaNameStatusProcessNameStationNameDeviceNameCreated: $areaNameStatusProcessNameStationNameDeviceNameCreated
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
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
      acknowledged
      closed
      resolutionTime
      acknowledgedTime
      status
      version
    }
    nextToken
  }
}
`;
export const getPermission = `query GetPermission($userId: ID!) {
  getPermission(userId: $userId) {
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
}
`;
export const listPermissions = `query ListPermissions(
  $limit: Int
  $nextToken: String
) {
  listPermissions(limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
  }
}
`;
export const listRootCauses = `query ListRootCauses(
  $limit: Int
  $nextToken: String
) {
  listRootCauses(limit: $limit, nextToken: $nextToken) {
    items {
      id
      rootCause
    }
    nextToken
  }
}
`;