/* eslint-disable @typescript-eslint/ban-ts-comment */
import type { NetworkError, UnknownError } from '@rest-hooks/normalizr';
import { EndpointInterface } from '@rest-hooks/normalizr';
import { useContext } from 'react';

import useController from '../hooks/useController.js';
import { StateContext } from '../context.js';

export type ErrorTypes = NetworkError | UnknownError;

type UseErrorReturn<P> = P extends [null] ? undefined : ErrorTypes | undefined;

/**
 * Get any errors for a given request
 * @see https://resthooks.io/docs/api/useError
 */
export default function useError<
  E extends Pick<EndpointInterface, 'key'>,
  Args extends readonly [...Parameters<E['key']>] | readonly [null],
>(endpoint: E, ...args: Args): UseErrorReturn<Args> {
  const state = useContext(StateContext);

  const controller = useController();

  return controller.getError(endpoint, ...args, state) as any;
}
