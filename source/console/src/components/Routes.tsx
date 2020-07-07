/*********************************************************************************************************************
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

// Interfaces
import { IRoute } from './Interfaces';

// Icons
import { GoLocation, GoPerson, GoEye, GoGraph, GoHistory, GoOrganization, GoLock, GoGear } from 'react-icons/go';

// Views
import Site from '../views/Site';
import Area from '../views/Area';
import Station from '../views/Station';
import Process from '../views/Process';
import Device from '../views/Device';
import Event from '../views/Event';
import Client from '../views/Client';
import Observer from '../views/Observer';
import Metrics from '../views/Metrics';
import History from '../views/History';
import User from '../views/User';
import Permission from '../views/Permission';
import PermissionSetting from '../views/PermissionSetting';
import RootCause from '../views/RootCause';

import { getLocaleString } from '../util/CustomUtil';

/**
 * Admin group routes
 */
export const adminRoutes: IRoute[] = [
  {
    path: '/sites',
    name: getLocaleString('Sites'),
    component: Site,
    icon: GoLocation,
    visible: true
  },
  {
    path: '/sites/:siteId',
    name: 'Site - Areas',
    component: Area,
    visible: false
  },
  {
    path: '/areas/:areaId/stations',
    name: 'Site - Area - Stations',
    component: Station,
    visible: false
  },
  {
    path: '/stations/:stationId',
    name: 'Site - Area - Station - Devices',
    component: Device,
    visible: false
  },
  {
    path: '/areas/:areaId/processes',
    name: 'Site - Area - Processes',
    component: Process,
    visible: false
  },
  {
    path: '/processes/:processId',
    name: 'Site - Area - Process - Events',
    component: Event,
    visible: false
  },
  {
    path: '/client',
    name: getLocaleString('Client'),
    component: Client,
    icon: GoPerson,
    visible: true
  },
  {
    path: '/observer',
    name: getLocaleString('Observer'),
    component: Observer,
    icon: GoEye,
    visible: true
  },
  {
    path: '/metrics',
    name: getLocaleString('Metrics'),
    component: Metrics,
    icon: GoGraph,
    visible: true
  },
  {
    path: '/history',
    name: getLocaleString('History'),
    component: History,
    icon: GoHistory,
    visible: true
  },
  {
    path: '/users',
    name: getLocaleString('Users'),
    component: User,
    icon: GoOrganization,
    visible: true
  },
  {
    path: '/permissions',
    name: getLocaleString('Permissions'),
    component: Permission,
    icon: GoLock,
    visible: true
  },
  {
    path: '/permissions/setting',
    name: getLocaleString('Permissions Setting'),
    component: PermissionSetting,
    visible: false
  },
  {
    path: '/rootcause',
    name: getLocaleString('Root Causes'),
    component: RootCause,
    icon: GoGear,
    visible: true
  }
];

/**
 * Manager group routes
 */
export const managerRoutes: IRoute[] = [
  {
    path: '/client',
    name: getLocaleString('Client'),
    component: Client,
    icon: GoPerson,
    visible: true
  },
  {
    path: '/observer',
    name: getLocaleString('Observer'),
    component: Observer,
    icon: GoEye,
    visible: true
  },
  {
    path: '/metrics',
    name: getLocaleString('Metrics'),
    component: Metrics,
    icon: GoGraph,
    visible: true
  },
  {
    path: '/history',
    name: getLocaleString('History'),
    component: History,
    icon: GoHistory,
    visible: true
  }
];

/**
 * Engineer group routes
 */
export const engineerRoutes: IRoute[] = [
  {
    path: '/client',
    name: getLocaleString('Client'),
    component: Client,
    icon: GoPerson,
    visible: true
  },
  {
    path: '/observer',
    name: getLocaleString('Observer'),
    component: Observer,
    icon: GoEye,
    visible: true
  }
];

/**
 * Associate group routes
 */
export const associateRoutes: IRoute[] = [
  {
    path: '/client',
    name: getLocaleString('Client'),
    component: Client,
    icon: GoPerson,
    visible: true
  }
];
