// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
/* eslint-disable */

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
    additionalDetails
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
    id
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
    id
  }
}`;
export const onCreateRootCause = `subscription OnCreateRootCause {
  onCreateRootCause {
    id
    name
  }
}`;
export const onDeleteRootCause = `subscription OnDeleteRootCause {
  onDeleteRootCause {
    id
    name
  }
}`;