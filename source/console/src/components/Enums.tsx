/**********************************************************************************************************************
 *  Copyright 2020 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/LICENSE-2.0                                                                    *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 *********************************************************************************************************************/

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