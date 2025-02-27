/*
  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.

  Licensed under the Apache License, Version 2.0 (the "License").
  You may not use this file except in compliance with the License.
  You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
 */
import { checkIsSupportedAsForm } from '../check-support';
import { GenericDataModel } from '../types';

describe('checkIsSupportedAsForm', () => {
  it('should return false if model has no fields', () => {
    const model: GenericDataModel = {
      fields: {},
    };

    expect(checkIsSupportedAsForm(model)).toBe(false);
  });

  it('should return false if all fields are unsupported', () => {
    const model: GenericDataModel = {
      fields: {
        nonModel: { dataType: { nonModel: 'myNonModel' }, required: false, readOnly: false, isArray: false },
        relationship: {
          dataType: 'ID',
          required: false,
          readOnly: false,
          isArray: false,
          relationship: { type: 'HAS_ONE', relatedModelName: 'RelatedModel' },
        },
      },
    };

    expect(checkIsSupportedAsForm(model)).toBe(false);
  });

  it('should return true if one supported field w unrequired unsupported fields', () => {
    const model: GenericDataModel = {
      fields: {
        nonModel: { dataType: { nonModel: 'myNonModel' }, required: false, readOnly: false, isArray: false },
        relationship: {
          dataType: 'ID',
          required: false,
          readOnly: false,
          isArray: false,
          relationship: { type: 'HAS_ONE', relatedModelName: 'RelatedModel' },
        },
        supportedField: { dataType: 'Boolean', required: false, readOnly: false, isArray: false },
      },
    };

    expect(checkIsSupportedAsForm(model)).toBe(true);
  });

  it('should return false if an unsupported field is required', () => {
    const model: GenericDataModel = {
      fields: {
        requiredNonModel: { dataType: { nonModel: 'myNonModel' }, required: true, readOnly: false, isArray: false },
        supportedField: { dataType: 'Boolean', required: false, readOnly: false, isArray: false },
      },
    };

    expect(checkIsSupportedAsForm(model)).toBe(false);
  });
});
