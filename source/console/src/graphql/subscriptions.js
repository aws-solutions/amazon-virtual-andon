/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateSite = `subscription OnCreateSite {
  onCreateSite {
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
export const onUpdateSite = `subscription OnUpdateSite {
  onUpdateSite {
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
export const onDeleteSite = `subscription OnDeleteSite {
  onDeleteSite {
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
export const onCreateArea = `subscription OnCreateArea {
  onCreateArea {
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
export const onUpdateArea = `subscription OnUpdateArea {
  onUpdateArea {
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
export const onDeleteArea = `subscription OnDeleteArea {
  onDeleteArea {
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
export const onCreateProcess = `subscription OnCreateProcess {
  onCreateProcess {
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
export const onUpdateProcess = `subscription OnUpdateProcess {
  onUpdateProcess {
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
export const onDeleteProcess = `subscription OnDeleteProcess {
  onDeleteProcess {
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
export const onCreateEvent = `subscription OnCreateEvent {
  onCreateEvent {
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
export const onUpdateEvent = `subscription OnUpdateEvent {
  onUpdateEvent {
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
export const onDeleteEvent = `subscription OnDeleteEvent {
  onDeleteEvent {
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
export const onCreateStation = `subscription OnCreateStation {
  onCreateStation {
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
export const onUpdateStation = `subscription OnUpdateStation {
  onUpdateStation {
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
export const onDeleteStation = `subscription OnDeleteStation {
  onDeleteStation {
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
export const onCreateDevice = `subscription OnCreateDevice {
  onCreateDevice {
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
export const onUpdateDevice = `subscription OnUpdateDevice {
  onUpdateDevice {
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
export const onDeleteDevice = `subscription OnDeleteDevice {
  onDeleteDevice {
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
export const onCreateIssue = `subscription OnCreateIssue {
  onCreateIssue {
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
export const onUpdateIssue = `subscription OnUpdateIssue {
  onUpdateIssue {
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
export const onDeleteIssue = `subscription OnDeleteIssue {
  onDeleteIssue {
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
