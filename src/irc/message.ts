type IRCMessageTags = { [key: string]: string };

export class IRCMessage {
  constructor(
    public prefix?: string,
    public nick?: string,
    public ident?: string,
    public hostname?: string,
    public command?: string,
    public params?: string[],
    public tags?: IRCMessageTags,
    public raw?: string,
  ) {}

  static fromLine(line: string): IRCMessage | undefined {
    const lineRegex = /^(?:@([^ ]+) )?(?::((?:(?:([^\s!@]+)(?:!([^\s@]+))?)@)?(\S+)) )?((?:[a-zA-Z]+)|(?:[0-9]{3}))(?: ([^:].*?))?(?: :(.*))?$/i;
    const newLineRegex = /^[\r\n]+|[\r\n]+$/g;

    const matches = lineRegex.exec(line.replace(newLineRegex, ''));

    if (!matches) {
      return;
    }

    const message = new IRCMessage();

    message.raw = line;

    if (matches[1]) {
      const rawTags = matches[1];

      const tags = rawTags.split(';').reduce((tags: IRCMessageTags, tag) => {
        if (tag.indexOf('=') === -1) {
          tags[tag] = tag;
        } else {
          const [key, value] = tag.split('=');
          tags[key] = value;
        }

        return tags;
      }, {});

      message.tags = tags;
    }

    message.prefix = matches[2] || '';
    message.nick = matches[3] || matches[2] || '';
    message.ident = matches[4] || '';
    message.hostname = matches[5] || '';
    message.command = matches[6] || '';
    message.params = matches[7] ? matches[7].split(/ +/) : [];

    if (typeof matches[8] !== 'undefined') {
      message.params.push(matches[8]);
    }

    return message;
  }

  toLine(): string {
    const message = [];

    if (this.tags) {
      const tags = Object.keys(this.tags).map(key => {
        const value = this.tags![key];

        if (value === key) {
          return value;
        }

        return `${key}=${value}`;
      });

      message.push('@' + tags.join(';'));
    }

    if (this.prefix) {
      message.push(':' + this.prefix);
    }

    message.push(this.command);

    if (this.params && this.params.length > 0) {
      this.params.forEach((param, idx) => {
        if (
          idx === this.params!.length - 1 &&
          (param.indexOf(' ') > -1 || param[0] === ':')
        ) {
          message.push(':' + param);
        } else {
          message.push(param);
        }
      });
    }

    return message.join(' ');
  }
}
