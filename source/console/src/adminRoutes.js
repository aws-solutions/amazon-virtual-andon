/*********************************************************************************************************************
 *  Copyright 2019 Amazon.com, Inc. or its affiliates. All Rights Reserved.                                           *
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

import Home from "views/Home.jsx";
import Site from "views/Site.jsx";
import SiteRegistration from "views/SiteRegistration.jsx";
import Area from "views/Area.jsx";
import AreaRegistration from "views/AreaRegistration.jsx";
import Process from "views/Process.jsx";
import ProcessRegistration from "views/ProcessRegistration.jsx";
import Event from "views/Event.jsx";
import EventRegistration from "views/EventRegistration.jsx";
import Station from "views/Station.jsx";
import StationRegistration from "views/StationRegistration.jsx";
import Device from "views/Device.jsx";
import DeviceRegistration from "views/DeviceRegistration.jsx";
import Client from "views/Client.jsx";
import Observer from "views/Observer.jsx";
import History from "views/History.jsx";
import Metrics from "views/Metrics.jsx";

const dashboardRoutes = [
    {
        path: "/home",
        name: "",
        icon: "pe-7s-home",
        component: Home,
        layout: "/admin",
        visible: false
    },
    {
        path: "/sites",
        name: "My Sites",
        icon: "pe-7s-lock",
        component: Site,
        layout: "/admin",
        visible: true
    },
    {
        path: "/sites/registration",
        name: "New Site Registration",
        icon: "pe-7s-home",
        component: SiteRegistration,
        layout: "/admin",
        visible: false
    },
    {
        path: "/sites/:siteId/areaRegistration",
        name: "New Area Registration",
        icon: "pe-7s-home",
        component: AreaRegistration,
        layout: "/admin",
        visible: false
    },
    {
        path: "/sites/:siteId/areas",
        name: "Site - Areas",
        icon: "pe-7s-home",
        component: Area,
        layout: "/admin",
        visible: false
    },
    {
        path: "/areas/:areaId/processRegistration",
        name: "New Process Registration",
        icon: "pe-7s-home",
        component: ProcessRegistration,
        layout: "/admin",
        visible: false
    },
    {
        path: "/areas/:areaId/processes",
        name: "Area - Processes",
        icon: "pe-7s-home",
        component: Process,
        layout: "/admin",
        visible: false
    },
    {
        path: "/processes/:processId/eventRegistration",
        name: "New Event Registration",
        icon: "pe-7s-home",
        component: EventRegistration,
        layout: "/admin",
        visible: false
    },
    {
        path: "/processes/:processId/events",
        name: "Area - Processes",
        icon: "pe-7s-home",
        component: Event,
        layout: "/admin",
        visible: false
    },
    {
        path: "/areas/:areaId/stationRegistration",
        name: "New Station Registration",
        icon: "pe-7s-home",
        component: StationRegistration,
        layout: "/admin",
        visible: false
    },
    {
        path: "/areas/:areaId/stations",
        name: "Area - Stations",
        icon: "pe-7s-home",
        component: Station,
        layout: "/admin",
        visible: false
    },
    {
        path: "/stations/:stationId/deviceRegistration",
        name: "New Device Registration",
        icon: "pe-7s-home",
        component: DeviceRegistration,
        layout: "/admin",
        visible: false
    },
    {
        path: "/stations/:stationId/devices",
        name: "Station - Devices",
        icon: "pe-7s-home",
        component: Device,
        layout: "/admin",
        visible: false
    },
    {
        path: "/client",
        name: "Client",
        icon: "pe-7s-id",
        component: Client,
        layout: "/admin",
        visible: true
    },
    {
        path: "/observer",
        name: "Observer",
        icon: "pe-7s-look",
        component: Observer,
        layout: "/admin",
        visible: true
    },
    {
        path: "/metrics",
        name: "Metrics",
        icon: "pe-7s-graph2",
        component: Metrics,
        layout: "/admin",
        visible: true
    },
    {
        path: "/history",
        name: "History",
        icon: "pe-7s-timer",
        component: History,
        layout: "/admin",
        visible: true
    }
];

export default dashboardRoutes;
