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
  $filter: ModelSiteFilterInput
  $limit: Int
  $nextToken: String
) {
  listSites(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      area {
        nextToken
      }
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
  $filter: ModelAreaFilterInput
  $limit: Int
  $nextToken: String
) {
  listAreas(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
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
    nextToken
  }
}
`;
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
        version
      }
      nextToken
    }
    version
  }
}
`;
export const listProcesss = `query ListProcesss(
  $filter: ModelProcessFilterInput
  $limit: Int
  $nextToken: String
) {
  listProcesss(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      area {
        id
        name
        description
        version
      }
      event {
        nextToken
      }
      version
    }
    nextToken
  }
}
`;
export const getEvents = `query GetEvents($id: ID!) {
  getEvents(id: $id) {
    id
    name
    description
    type
    priority
    sms
    email
    process {
      id
      name
      description
      area {
        id
        name
        description
        version
      }
      event {
        nextToken
      }
      version
    }
    version
  }
}
`;
export const listEvents = `query ListEvents(
  $filter: ModelEventFilterInput
  $limit: Int
  $nextToken: String
) {
  listEvents(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      type
      priority
      sms
      email
      process {
        id
        name
        description
        version
      }
      version
    }
    nextToken
  }
}
`;
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
  $filter: ModelStationFilterInput
  $limit: Int
  $nextToken: String
) {
  listStations(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      area {
        id
        name
        description
        version
      }
      device {
        nextToken
      }
      version
    }
    nextToken
  }
}
`;
export const getDevice = `query GetDevice($id: ID!) {
  getDevice(id: $id) {
    id
    name
    description
    station {
      id
      name
      description
      area {
        id
        name
        description
        version
      }
      device {
        nextToken
      }
      version
    }
    version
  }
}
`;
export const listDevices = `query ListDevices(
  $filter: ModelDeviceFilterInput
  $limit: Int
  $nextToken: String
) {
  listDevices(filter: $filter, limit: $limit, nextToken: $nextToken) {
    items {
      id
      name
      description
      station {
        id
        name
        description
        version
      }
      version
    }
    nextToken
  }
}
`;
export const issuesByStatusOnly = `query IssuesByStatusOnly(
  $status: Status
  $created: ModelStringKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelIssueFilterInput
  $limit: Int
  $nextToken: String
) {
  issuesByStatusOnly(
    status: $status
    created: $created
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
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
export const issuesBySiteAreaStatus = `query IssuesBySiteAreaStatus(
  $siteName: String
  $areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: ModelIssueBySiteAreaStatusCompositeKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelIssueFilterInput
  $limit: Int
  $nextToken: String
) {
  issuesBySiteAreaStatus(
    siteName: $siteName
    areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated: $areaNameStatusProcessNameEventDescriptionStationNameDeviceNameCreated
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
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
export const issuesByDevice = `query IssuesByDevice(
  $siteName: String
  $areaNameStatusProcessNameStationNameDeviceNameCreated: ModelIssueByDeviceCompositeKeyConditionInput
  $sortDirection: ModelSortDirection
  $filter: ModelIssueFilterInput
  $limit: Int
  $nextToken: String
) {
  issuesByDevice(
    siteName: $siteName
    areaNameStatusProcessNameStationNameDeviceNameCreated: $areaNameStatusProcessNameStationNameDeviceNameCreated
    sortDirection: $sortDirection
    filter: $filter
    limit: $limit
    nextToken: $nextToken
  ) {
    items {
      id
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
export const getIssue = `query GetIssue($id: ID!) {
  getIssue(id: $id) {
    id
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
}
`;
export const listIssue = `query ListIssue(
  $id: ID
  $filter: ModelIssueFilterInput
  $limit: Int
  $nextToken: String
  $sortDirection: ModelSortDirection
) {
  listIssue(
    id: $id
    filter: $filter
    limit: $limit
    nextToken: $nextToken
    sortDirection: $sortDirection
  ) {
    items {
      id
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
