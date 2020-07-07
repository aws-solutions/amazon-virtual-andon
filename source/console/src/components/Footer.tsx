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

// Import React packages
import React from 'react';

// Import React Bootstrap components
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';

// Import custom setting
import { getLocaleString } from '../util/CustomUtil';

/**
 * Properties Interface
 * @interface IProps
 */
interface IProps {}

/**
 * State Interface
 * @interface IState
 */
interface IState {}

/**
 * Footer class returns the default footer HTML tags including copyright and AWS Solutions link.
 * @class Footer
 */
class Footer extends React.Component<IProps, IState> {
  /**
   * Render the footer page.
   */
  render() {
    return (
      <footer key="footer">
        <Navbar bg="light" fixed="bottom">
          <Navbar.Collapse className="justify-content-end">
            <Nav>
              <Nav.Link href="https://aws.amazon.com/solutions/">{ getLocaleString('AWS Solutions') }</Nav.Link>
            </Nav>
          </Navbar.Collapse>
        </Navbar>
      </footer>
    );
  }
}

export default Footer;