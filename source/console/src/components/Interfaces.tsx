// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Import React packages
import React from 'react';
import { IconType } from 'react-icons/lib/cjs';

/**
 * Page route interface
 * @interface IRoute
 */
export interface IRoute {
  path: string;
  nameCode?: string;
  description: string;
  component: typeof React.Component;
  icon?: IconType;
  visible: boolean;
  search?: string;
}

/**
 * General GraphQL query data interface
 * @interface IGeneralQueryData
 */
export interface IGeneralQueryData {
  parentId?: string;
  id?: string;
  type: string;
  name: string;
  description: string;
  version?: number;
  visible?: boolean;
  alias?: string;
}

/**
 * Event interface
 * @interface IEvent
 */
export interface IEvent extends IGeneralQueryData {
  eventProcessId?: string;
  priority: string;
  sms?: string;
  email?: string;
  rootCauses?: string[];
  isActive?: boolean;
  isClosedRejected?: boolean;
  isOpen?: boolean;
  isAcknowledged?: boolean;
  activeIssueId?: string;
  updateIssueVersion?: number;
  createIssueTime?: string;
  createIssueTimeUtc?: string;
  eventImgKey?: string;
  eventType?: string;
  issueAdditionalDetails?: string;
}

/**
 * Event update interface
 * @interface IEventUpdate
 */
export interface IEventUpdate {
  id: string;
  sms?: string;
  email?: string;
  previousSms?: string;
  previousEmail?: string;
  rootCauses: string[];
  eventImgKey?: string;
  alias?: string;
}

/**
 * Issue interface
 * @interface IIssue
 */
export interface IIssue {
  id: string;
  eventId: string;
  eventDescription: string;
  type: string;
  priority: string;
  siteName: string;
  processName: string;
  areaName: string;
  stationName: string;
  deviceName: string;
  created: string;
  createdAt: string;
  acknowledged: string;
  closed: string;
  resolutionTime: number;
  acknowledgedTime: number;
  status: string;
  version: number;
  visible?: boolean;
  expectedVersion?: number;
  rootCause?: string | null;
  comment?: string | null;
  createdBy: string;
  closedBy?: string;
  acknowledgedBy?: string;
  rejectedBy?: string;
  openFor?: number | string | null;
  additionalDetails?: string;
}

/**
 * UpdateIssueResponse Interface
 * @interface IUpdateIssueResponse
 */
 export interface IUpdateIssueResponse {
  data: {
    updateIssue?: {
      id: string;
      eventId: string;
      eventDescription: string;
      type: string;
      priority: string;
      siteName: string;
      processName: string;
      areaName: string;
      stationName: string;
      deviceName: string;
      created: string;
      createdAt: string;
      acknowledged: string;
      closed: string;
      resolutionTime: string;
      acknowledgedTime: string;
      status: string;
      version: string;
      rootCause: string;
      comment: string;
    }
  },
  errors?: any[];
}

/**
 * Top issue interface
 * @interface ITopIssue
 */
export interface ITopIssue {
  processName: string;
  eventDescription: string;
  count: number;
  totalResolutionSeconds: number;
  averageResolutionTime?: number;
}

/**
 * Selected data interface
 * @interface ISelectedData
 */
export interface ISelectedData {
  id?: string;
  name: string;
  parentId?: string;
}

/**
 * User interface
 * @interface IUser
 */
export interface IUser {
  username: string;
  groups: string[];
  status: string;
  userId?: string;
  visible?: boolean;
}

/**
 * CSV User interface
 * @interface ICSVUser
 */
export interface ICSVUser {
  username: string;
  groups: string;
}

/**
 * File upload result interface
 * @interface IUploadResult
 */
export interface IUploadResult {
  name: string;
  result: string;
}

/**
 * Permission interface
 * @interface IPermission
 */
export interface IPermission {
  id: string;
  username: string;
  sites: ISelectedData[];
  areas: ISelectedData[];
  processes: ISelectedData[];
  stations: ISelectedData[];
  devices: ISelectedData[];
  version: number;
  visible?: boolean;
}

/**
 * Root cause interface
 * @interface IRootCause
 */
export interface IRootCause {
  id: string;
  name: string;
  visible?: boolean;
  deleted?: boolean;
}

/**
 * Represents all aspects of a site
 * @interface ISiteData
 */
export interface ISiteData {
  siteName: string;
  areas: ISelectedData[];
  processes: ISelectedData[];
  stations: ISelectedData[];
  devices: ISelectedData[];
}