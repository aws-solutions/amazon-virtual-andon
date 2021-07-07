/* eslint-disable */
// this is an auto generated file. This will be overwritten

export const onCreateIssue = `subscription OnCreateIssue {
  onCreateIssue {
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
  }
}
`;
export const onUpdateIssue = `subscription OnUpdateIssue {
  onUpdateIssue {
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
}
`;
export const onPutPermission = `subscription OnPutPermission {
  onPutPermission {
    userId
    sites {
      id
      name
      parentId
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
  }
}`;
export const onDeletePermission = `subscription OnDeletePermission {
  onDeletePermission {
    userId
  }
}`;
export const onCreateRootCause = `subscription OnCreateRootCause {
  onCreateRootCause {
    id
    rootCause
  }
}`;
export const onDeleteRootCause = `subscription OnDeletePermission {
  onDeleteRootCause {
    id
    rootCause
  }
}`;