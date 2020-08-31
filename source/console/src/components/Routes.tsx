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

/**
 * Admin group routes
 */
export const adminRoutes: IRoute[] = [
  {
    path: '/sites',
    nameCode: 'text.sites',
    description: 'Sites',
    component: Site,
    icon: GoLocation,
    visible: true
  },
  {
    path: '/sites/:siteId',
    description: 'Site - Areas',
    component: Area,
    visible: false
  },
  {
    path: '/areas/:areaId/stations',
    description: 'Site - Area - Stations',
    component: Station,
    visible: false
  },
  {
    path: '/stations/:stationId',
    description: 'Site - Area - Station - Devices',
    component: Device,
    visible: false
  },
  {
    path: '/areas/:areaId/processes',
    description: 'Site - Area - Processes',
    component: Process,
    visible: false
  },
  {
    path: '/processes/:processId',
    description: 'Site - Area - Process - Events',
    component: Event,
    visible: false
  },
  {
    path: '/client',
    nameCode: 'menu.client',
    description: 'Client',
    component: Client,
    icon: GoPerson,
    visible: true
  },
  {
    path: '/observer',
    nameCode: 'menu.observer',
    description: 'Observer',
    component: Observer,
    icon: GoEye,
    visible: true
  },
  {
    path: '/metrics',
    nameCode: 'text.metrics',
    description: 'Metrics',
    component: Metrics,
    icon: GoGraph,
    visible: true
  },
  {
    path: '/history',
    nameCode: 'text.history',
    description: 'Histroy',
    component: History,
    icon: GoHistory,
    visible: true
  },
  {
    path: '/users',
    nameCode:'text.users',
    description: 'User',
    component: User,
    icon: GoOrganization,
    visible: true
  },
  {
    path: '/permissions',
    nameCode: 'text.permissions',
    description: 'Permission',
    component: Permission,
    icon: GoLock,
    visible: true
  },
  {
    path: '/permissions/setting',
    description: 'Permission Setting',
    component: PermissionSetting,
    visible: false
  },
  {
    path: '/rootcause',
    nameCode: 'text.rootcauses',
    description: 'Root Cause',
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
    nameCode: 'menu.client',
    description: 'Client',
    component: Client,
    icon: GoPerson,
    visible: true
  },
  {
    path: '/observer',
    nameCode: 'menu.observer',
    description: 'Observer',
    component: Observer,
    icon: GoEye,
    visible: true
  },
  {
    path: '/metrics',
    nameCode: 'text.metrics',
    description: 'Metrics',
    component: Metrics,
    icon: GoGraph,
    visible: true
  },
  {
    path: '/history',
    nameCode: 'text.history',
    description: 'History',
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
    nameCode: 'menu.client',
    description: 'Client',
    component: Client,
    icon: GoPerson,
    visible: true
  },
  {
    path: '/observer',
    nameCode: 'menu.observer',
    description: 'Observer',
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
    nameCode: 'menu.client',
    description: 'Client',
    component: Client,
    icon: GoPerson,
    visible: true
  }
];
