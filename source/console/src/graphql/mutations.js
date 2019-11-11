/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const createSite = `mutation CreateSite($input: CreateSiteInput!) {
  createSite(input: $input) {
    id
    name
    area {
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
export const updateSite = `mutation UpdateSite($input: UpdateSiteInput!) {
  updateSite(input: $input) {
    id
    name
    area {
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
export const deleteSite = `mutation DeleteSite($input: DeleteSiteInput!) {
  deleteSite(input: $input) {
    id
    name
    area {
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
export const createArea = `mutation CreateArea($input: CreateAreaInput!) {
  createArea(input: $input) {
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
    process {
      items {
        id
        name
        description
        version
      }
      nextToken
    }
    station {
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
export const updateArea = `mutation UpdateArea($input: UpdateAreaInput!) {
  updateArea(input: $input) {
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
    process {
      items {
        id
        name
        description
        version
      }
      nextToken
    }
    station {
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
export const deleteArea = `mutation DeleteArea($input: DeleteAreaInput!) {
  deleteArea(input: $input) {
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
    process {
      items {
        id
        name
        description
        version
      }
      nextToken
    }
    station {
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
export const createProcess = `mutation CreateProcess($input: CreateProcessInput!) {
  createProcess(input: $input) {
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
    event {
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
export const updateProcess = `mutation UpdateProcess($input: UpdateProcessInput!) {
  updateProcess(input: $input) {
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
    event {
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
export const deleteProcess = `mutation DeleteProcess($input: DeleteProcessInput!) {
  deleteProcess(input: $input) {
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
    event {
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
export const createEvent = `mutation CreateEvent($input: CreateEventInput!) {
  createEvent(input: $input) {
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
export const updateEvent = `mutation UpdateEvent($input: UpdateEventInput!) {
  updateEvent(input: $input) {
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
export const deleteEvent = `mutation DeleteEvent($input: DeleteEventInput!) {
  deleteEvent(input: $input) {
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
export const createStation = `mutation CreateStation($input: CreateStationInput!) {
  createStation(input: $input) {
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
    device {
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
export const updateStation = `mutation UpdateStation($input: UpdateStationInput!) {
  updateStation(input: $input) {
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
    device {
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
export const deleteStation = `mutation DeleteStation($input: DeleteStationInput!) {
  deleteStation(input: $input) {
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
    device {
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
export const createDevice = `mutation CreateDevice($input: CreateDeviceInput!) {
  createDevice(input: $input) {
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
export const updateDevice = `mutation UpdateDevice($input: UpdateDeviceInput!) {
  updateDevice(input: $input) {
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
export const deleteDevice = `mutation DeleteDevice($input: DeleteDeviceInput!) {
  deleteDevice(input: $input) {
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
export const createIssue = `mutation CreateIssue($input: CreateIssueInput!) {
  createIssue(input: $input) {
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
export const updateIssue = `mutation UpdateIssue($input: UpdateIssueInput!) {
  updateIssue(input: $input) {
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
export const deleteIssue = `mutation DeleteIssue($input: DeleteIssueInput!) {
  deleteIssue(input: $input) {
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
