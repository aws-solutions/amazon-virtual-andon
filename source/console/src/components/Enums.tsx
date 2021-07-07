// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

/**
 * Enumerate for the modal type.
 * @enum ModalType
 */
export enum ModalType {
  None,
  Add,
  Delete,
  Edit,
  Upload
}

/**
 * Enumerate for the event priority.
 * @enum EventPriority
 */
export enum EventPriority {
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical'
}

/**
 * Enumerate for the sort by keyword.
 * @enum SortBy
 */
export enum SortBy {
  Asc = 'asc',
  Desc = 'desc'
}

/**
 * Enumerate for the user group.
 * @enum UserGroups
 */
export enum UserGroups {
  AdminGroup = 'AdminGroup',
  ManagerGroup = 'ManagerGroup',
  EngineerGroup = 'EngineerGroup',
  AssociateGroup = 'AssociateGroup'
}

/**
 * Various types of permissions a user can have
 * @enum PermissionTypes
 */
export enum AVAPermissionTypes {
  Site = 'Site',
  Area = 'Area',
  Process = 'Process',
  Station = 'Station',
  Device = 'Device'
}