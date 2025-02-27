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

import ts, { Statement, factory, ObjectLiteralExpression, Expression } from 'typescript';
import {
  InvalidInputError,
  StudioComponent,
  StudioComponentChild,
  ActionStudioComponentEvent,
  StudioComponentProperty,
  MutationAction,
  ComponentMetadata,
} from '@aws-amplify/codegen-ui';
import { isActionEvent, propertyToExpression, getSetStateName, sanitizeName } from '../react-component-render-helper';
import { ImportCollection, ImportSource, ImportValue } from '../imports';
import { getChildPropMappingForComponentName } from './utils';

enum Action {
  'Amplify.Navigation' = 'Amplify.Navigation',
  'Amplify.DataStoreCreateItemAction' = 'Amplify.DataStoreCreateItemAction',
  'Amplify.DataStoreUpdateItemAction' = 'Amplify.DataStoreUpdateItemAction',
  'Amplify.DataStoreDeleteItemAction' = 'Amplify.DataStoreDeleteItemAction',
  'Amplify.AuthSignOut' = 'Amplify.AuthSignOut',
  'Amplify.Mutation' = 'Amplify.Mutation',
}

export default Action;

export const ActionNameMapping: Partial<Record<Action, ImportValue>> = {
  [Action['Amplify.Navigation']]: ImportValue.USE_NAVIGATE_ACTION,
  [Action['Amplify.DataStoreCreateItemAction']]: ImportValue.USE_DATA_STORE_CREATE_ACTION,
  [Action['Amplify.DataStoreUpdateItemAction']]: ImportValue.USE_DATA_STORE_UPDATE_ACTION,
  [Action['Amplify.DataStoreDeleteItemAction']]: ImportValue.USE_DATA_STORE_DELETE_ACTION,
  [Action['Amplify.AuthSignOut']]: ImportValue.USE_AUTH_SIGN_OUT_ACTION,
  [Action['Amplify.Mutation']]: ImportValue.USE_STATE_MUTATION_ACTION,
};

const DataStoreActions = new Set([
  Action['Amplify.DataStoreCreateItemAction'],
  Action['Amplify.DataStoreDeleteItemAction'],
  Action['Amplify.DataStoreUpdateItemAction'],
]);

function isMutationAction(action: ActionStudioComponentEvent): action is MutationAction {
  return (action.action as Action) === Action['Amplify.Mutation'];
}

export function getActionHookImportValue(action: string): ImportValue {
  const actionName = ActionNameMapping[Action[action as Action]];
  if (actionName === undefined) {
    throw new InvalidInputError(`${action} is not a valid action.`);
  }
  return actionName;
}

export function getComponentActions(component: StudioComponent | StudioComponentChild): {
  action: ActionStudioComponentEvent;
  identifier: string;
}[] {
  const actions = [];
  if (component.events) {
    actions.push(
      ...Object.entries(component.events)
        // need 'action is ...' so that typescript will know all items after filter are ActionStudioComponentEvent type
        .filter((action): action is [string, ActionStudioComponentEvent] => isActionEvent(action[1]))
        .map(([event, action]) => ({ action, identifier: getActionIdentifier(component.name, event) })),
    );
  }
  if (component.children) {
    actions.push(...component.children.map(getComponentActions).flat());
  }
  return actions;
}

export function getActionIdentifier(componentName: string, event: string) {
  const name = sanitizeName(componentName);
  return [name.charAt(0).toLowerCase() + name.slice(1), event.charAt(0).toUpperCase() + event.slice(1)].join('');
}

export function buildUseActionStatement(
  componentMetadata: ComponentMetadata,
  action: ActionStudioComponentEvent,
  identifier: string,
  importCollection: ImportCollection,
): Statement {
  if (isMutationAction(action)) {
    return buildMutationActionStatement(componentMetadata, action, identifier);
  }

  const actionHookImportValue = getActionHookImportValue(action.action);
  importCollection.addMappedImport(actionHookImportValue);
  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(identifier),
          undefined,
          undefined,
          factory.createCallExpression(
            factory.createIdentifier(actionHookImportValue),
            undefined,
            buildActionArguments(componentMetadata, action, importCollection),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

export function buildMutationActionStatement(
  componentMetadata: ComponentMetadata,
  action: MutationAction,
  identifier: string,
) {
  const { componentName, property } = action.parameters.state;
  const childrenPropMapping = getChildPropMappingForComponentName(componentMetadata, componentName);
  const stateReference =
    childrenPropMapping !== undefined && property === childrenPropMapping
      ? { ...action.parameters.state, property: 'children' }
      : action.parameters.state;

  const setState = getSetStateName(stateReference);

  return factory.createVariableStatement(
    undefined,
    factory.createVariableDeclarationList(
      [
        factory.createVariableDeclaration(
          factory.createIdentifier(identifier),
          undefined,
          undefined,
          factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            factory.createToken(ts.SyntaxKind.EqualsGreaterThanToken),
            factory.createBlock(
              [
                factory.createExpressionStatement(
                  factory.createCallExpression(factory.createIdentifier(setState), undefined, [
                    propertyToExpression(componentMetadata, action.parameters.state.set),
                  ]),
                ),
              ],
              true,
            ),
          ),
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

/* Transform the action parameters field to literal
 *
 * model and fields are special cases. All other fields are StudioComponentProperty
 */
export function buildActionArguments(
  componentMetadata: ComponentMetadata,
  action: ActionStudioComponentEvent,
  importCollection: ImportCollection,
): ObjectLiteralExpression[] | undefined {
  if (action.parameters) {
    const properties = Object.entries(action.parameters).map(([key, value]) =>
      factory.createPropertyAssignment(
        factory.createIdentifier(key),
        getActionParameterValue(componentMetadata, key, value, importCollection),
      ),
    );

    if (DataStoreActions.has(action.action as Action)) {
      addSchemaToArguments(properties, importCollection);
    }
    return [factory.createObjectLiteralExpression(properties, false)];
  }

  return undefined;
}

export function addSchemaToArguments(properties: ts.PropertyAssignment[], importCollection: ImportCollection) {
  const SCHEMA = 'schema';
  properties.push(factory.createPropertyAssignment(factory.createIdentifier(SCHEMA), factory.createIdentifier(SCHEMA)));
  importCollection.addImport(ImportSource.LOCAL_SCHEMA, SCHEMA);
}

export function getActionParameterValue(
  componentMetadata: ComponentMetadata,
  key: string,
  value: StudioComponentProperty | { [key: string]: StudioComponentProperty } | string,
  importCollection: ImportCollection,
): Expression {
  if (key === 'model') {
    const modelName = importCollection.addImport(ImportSource.LOCAL_MODELS, value as string);
    return factory.createIdentifier(modelName);
  }
  if (key === 'fields') {
    return factory.createObjectLiteralExpression(
      Object.entries(value).map(([nestedKey, nestedValue]) =>
        factory.createPropertyAssignment(
          factory.createIdentifier(nestedKey),
          getActionParameterValue(componentMetadata, nestedKey, nestedValue, importCollection),
        ),
      ),
      false,
    );
  }
  return propertyToExpression(componentMetadata, value as StudioComponentProperty);
}
