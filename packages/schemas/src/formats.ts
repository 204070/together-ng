import { FormatRegistry } from '@sinclair/typebox/type';

const emailPattern = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const e164Pattern = /^\+[1-9]\d{1,14}$/;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const dateTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

FormatRegistry.Set('email', (value) => emailPattern.test(value));
FormatRegistry.Set('e164', (value) => e164Pattern.test(value));
FormatRegistry.Set('uuid', (value) => uuidPattern.test(value));
FormatRegistry.Set('date-time', (value) => dateTimePattern.test(value));
