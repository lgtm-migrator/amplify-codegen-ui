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
import { authorHasManySchema, generateWithAmplifyRenderer } from '../__utils__';

describe('nested query collections', () => {
  it('should contain nested query generated resources', () => {
    const { componentText } = generateWithAmplifyRenderer('authorCollectionComponent', {}, false, authorHasManySchema);
    // check nested model is imported
    expect(componentText).toContain('import { Author, Book } from "../models";');

    // check binding calls are generated
    expect(componentText).toContain('const bookItems = useDataStoreBinding');
    expect(componentText).toContain('const itemsDataStore = useDataStoreBinding');

    // check for filter function in books
    expect(componentText).toContain('books: bookItems.filter((model) => model.authorID === item.id),');
  });

  it('should only contain first level query for collection when data schema is not passed down', () => {
    const { componentText } = generateWithAmplifyRenderer('authorCollectionComponent');
    // check only first level model is imported
    expect(componentText).toContain('import { Author } from "../models";');
    // only contains binding call for author and not books
    expect(componentText).not.toContain('const bookItems = useDataStoreBinding');
    expect(componentText).toContain('const itemsDataStore = useDataStoreBinding');

    // should not contain filter function
    expect(componentText).not.toContain('books: bookItems.filter((model) => model.authorID === item.id),');
  });
});
