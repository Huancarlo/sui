// Copyright (c) 2022, Mysten Labs, Inc.
// SPDX-License-Identifier: Apache-2.0
import { useQuery } from '@tanstack/react-query';
import cl from 'classnames';
import Highlight, { defaultProps, Prism } from 'prism-react-renderer';
import 'prism-themes/themes/prism-one-light.css';
import { useContext } from 'react';
import { Link } from 'react-router-dom';

import { NetworkContext } from '../../context';
import codestyle from '../../styles/bytecode.module.css';
import { DefaultRpcClient as rpc } from '../../utils/api/DefaultRpcClient';
import { normalizeSuiAddress } from '../../utils/stringUtils';

import type { SuiMoveNormalizedType } from '@mysten/sui.js';
import type { Language } from 'prism-react-renderer';

import styles from './ModuleView.module.css';

// inclue Rust language.
// @ts-ignore
(typeof global !== 'undefined' ? global : window).Prism = Prism;
require('prismjs/components/prism-rust');

interface Props {
    id?: string;
    name: string;
    code: string;
}

interface TypeReference {
    address: string;
    module: string;
    name: string;
    type_arguments: SuiMoveNormalizedType[];
}

/** Takes a normalized move type and returns the address information contained within it */
function unwrapTypeReference(
    type: SuiMoveNormalizedType
): null | TypeReference {
    if (typeof type === 'object') {
        if ('Struct' in type) {
            return type.Struct;
        }
        if ('Reference' in type) {
            return unwrapTypeReference(type.Reference);
        }
        if ('MutableReference' in type) {
            return unwrapTypeReference(type.MutableReference);
        }
        if ('Vector' in type) {
            return unwrapTypeReference(type.Vector);
        }
    }
    return null;
}

function ModuleView({ id, name, code }: Props) {
    const [network] = useContext(NetworkContext);
    const { data: normalizedModuleReferences } = useQuery(
        ['normalized-module', id, name],
        async () => {
            const normalizedModule = await rpc(network).getNormalizedMoveModule(
                id!,
                name
            );

            const typeReferences: Record<string, TypeReference> = {};

            Object.values(normalizedModule.exposed_functions).forEach(
                (exposedFunction) => {
                    exposedFunction.parameters.forEach((param) => {
                        const unwrappedType = unwrapTypeReference(param);
                        if (!unwrappedType) return;
                        typeReferences[unwrappedType.name] = unwrappedType;

                        unwrappedType.type_arguments.forEach((typeArg) => {
                            const unwrappedTypeArg =
                                unwrapTypeReference(typeArg);
                            if (!unwrappedTypeArg) return;
                            typeReferences[unwrappedTypeArg.name] =
                                unwrappedTypeArg;
                        });
                    });
                }
            );

            return typeReferences;
        },
        {
            enabled: !!id,
        }
    );

    return (
        <section className={styles.modulewrapper}>
            <div className={styles.moduletitle}>{name}</div>
            <div className={cl(codestyle.code, styles.codeview)}>
                <Highlight
                    {...defaultProps}
                    code={code}
                    language={'rust' as Language}
                    theme={undefined}
                >
                    {({
                        className,
                        style,
                        tokens,
                        getLineProps,
                        getTokenProps,
                    }) => (
                        <pre className={className} style={style}>
                            {tokens.map((line, i) => (
                                <div
                                    {...getLineProps({ line, key: i })}
                                    key={i}
                                    className={styles.codeline}
                                >
                                    <div className={styles.codelinenumbers}>
                                        {i + 1}
                                    </div>

                                    {line.map((token, key) => {
                                        const reference =
                                            normalizedModuleReferences?.[
                                                token.content
                                            ];

                                        if (
                                            (token.types.includes(
                                                'class-name'
                                            ) ||
                                                token.types.includes(
                                                    'constant'
                                                )) &&
                                            reference
                                        ) {
                                            const href = `/objects/${reference.address}?module=${reference.module}`;

                                            return (
                                                <Link
                                                    key={key}
                                                    {...getTokenProps({
                                                        token,
                                                        key,
                                                    })}
                                                    to={href}
                                                    target={
                                                        normalizeSuiAddress(
                                                            reference.address
                                                        ) ===
                                                        normalizeSuiAddress(id!)
                                                            ? undefined
                                                            : '_blank'
                                                    }
                                                />
                                            );
                                        }

                                        return (
                                            <span
                                                {...getTokenProps({
                                                    token,
                                                    key,
                                                })}
                                                key={key}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>
        </section>
    );
}

export default ModuleView;
