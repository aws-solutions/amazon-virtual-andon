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
