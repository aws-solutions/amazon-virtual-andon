// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

// Interfaces
import { IRoute } from './Interfaces';

// Icons
import { GoLocation, GoPerson, GoEye, GoGraph, GoOrganization, GoLock, GoGear } from 'react-icons/go';

// Views
import Site from '../views/Site';
import Area from '../views/Area';
import Station from '../views/Station';
import Process from '../views/Process';
import Device from '../views/Device';
import Event from '../views/Event';
import Client from '../views/Client';
import Observer from '../views/Observer';
import IssuesReport from '../views/IssuesReport';
import User from '../views/User';
import Permission from '../views/Permission';
import PermissionSetting from '../views/PermissionSetting';
import RootCause from '../views/RootCause';
import AddEditEvent from '../views/AddEditEvent';

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
    path: '/issuesreport',
    nameCode: 'text.issues.report',
    description: 'Issues Report',
    component: IssuesReport,
    icon: GoGraph,
    visible: true
  },
  {
    path: '/users',
    nameCode: 'text.users',
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
  },
  {
    path: '/processes/:processId/event',
    description: 'Add Event',
    component: AddEditEvent,
    visible: false
  },
  {
    path: '/processes/:processId/event/:eventId',
    description: 'Edit Event',
    component: AddEditEvent,
    visible: false
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
    path: '/issuesreport',
    nameCode: 'text.issues.report',
    description: 'Issues Report',
    component: IssuesReport,
    icon: GoGraph,
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
