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

import React, { Component } from "react";
import {
  Grid,
  Row,
  Col,
} from 'react-bootstrap';
import logo from "assets/img/aws-solutions.png";
import { Card } from "components/Card/Card.jsx";

class Home extends Component {
  constructor(props) {
    super(props);

    // Sets up initial state
    this.state = {

    };
  }

  componentDidMount() {

  }

  render() {
    return (
      <div className="content">
        <Grid fluid>
          <Row>
            <Col md={10} mdOffset={1}>
              <Card
                title="Amazon Virtual Andon"
                content={
                  <div className="ava_details">
                    <div className="logo">
                      <Col md={10} mdOffset={3}>
                        <img src={logo} alt="logo_image" mode='fit' />
                      </Col>
                    </div>
                    <div className="clearfix" />
                  </div>
                }
              />
            </Col>
          </Row>
        </Grid>
      </div>
    );
  }


}

export default Home;
