/**
 * Copyright 2023 LINE Corporation
 *
 * LINE Corporation licenses this file to you under the Apache License,
 * version 2.0 (the "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at:
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 */
import {
  FocusEvent,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlignSelect,
  ColorPicker,
  EditableImage,
  GuideDialog,
  OpacityRange,
  Select,
  TextButton,
  ToggleOption,
} from "@/components";
import {
  Alignment,
  Alignments,
  Font,
  Fonts,
  FontSize,
  FontSizes,
  InputField,
  InputFieldGroup,
  PartnerLogoPosition,
  PartnerLogoPositions,
  PartnerLogoSize,
  PartnerLogoSizes,
  Theme,
} from "@/constants";
import { useAppConfiguration, useImageColor, usePartnerLogo } from "@/hooks";
import { IconGithub } from "@/icons";
import { convertRgbToHex } from "@/utils";
import styles from "./Editor.module.scss";

const DEFAULT_FONT_STYLE = "LINE Seed";
const AUTO = "auto";

const partnerLogoPositionOptions = [
  { name: "Auto", value: AUTO },
  ...(Object.keys(PartnerLogoPositions) as Array<PartnerLogoPosition>).map(
    (position) => ({ name: PartnerLogoPositions[position], value: position }),
  ),
];

const partnerLogoSizeOptions = [
  { name: "Auto", value: AUTO },
  ...(Object.keys(PartnerLogoSizes) as Array<PartnerLogoSize>).map((size) => ({
    name: size,
    value: size,
  })),
];

const Editor = forwardRef<HTMLDivElement>((_, ref) => {
  const { themes, selectedImage, selectedTheme, defaultInputFields } =
    useAppConfiguration();
  const { src, fontColor, theme } = selectedImage;
  const { isDarkImage } = useImageColor(src);
  const [dragKey, setDragKey] = useState("");
  const [guideVisible, setGuideVisible] = useState(false);
  const [isImageFlip, setIsImageFlip] = useState(false);
  const [initialColor, setInitialColor] = useState("");
  const [focusedInput, setFocusedInput] = useState("");
  const focusedAreaRef = useRef<HTMLUListElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement>>({});
  const [inputOptions, setInputOptions] = useState<Record<string, InputField>>(
    {},
  );
  const initialInputFields =
    ((themes.filter(({ name }) => name === theme)?.[0] as Theme)
      ?.inputFields as Array<InputFieldGroup>) ?? defaultInputFields;
  const [inputFields, setInputFields] =
    useState<Array<InputFieldGroup>>(initialInputFields);
  const {
    config: partnerLogoConfig,
    aspect: partnerLogoAspect,
    placement: partnerLogoAutoPlacement,
  } = usePartnerLogo(
    src,
    inputFields.map(({ position }) => position),
  );
  const [isPartnerLogoVisible, setIsPartnerLogoVisible] = useState(
    partnerLogoConfig?.isVisible ?? true,
  );
  const [partnerLogoPosition, setPartnerLogoPosition] = useState<
    PartnerLogoPosition | typeof AUTO
  >(AUTO);
  const [partnerLogoSize, setPartnerLogoSize] = useState<
    PartnerLogoSize | typeof AUTO
  >(AUTO);
  const partnerLogo =
    partnerLogoConfig && isPartnerLogoVisible
      ? {
          src: partnerLogoConfig.src,
          alt: partnerLogoConfig.alt,
          aspect: partnerLogoAspect,
          placement: {
            position:
              partnerLogoPosition === AUTO
                ? partnerLogoAutoPlacement.position
                : partnerLogoPosition,
            size:
              partnerLogoSize === AUTO
                ? partnerLogoAutoPlacement.size
                : PartnerLogoSizes[partnerLogoSize],
          },
        }
      : null;

  const handleClickGithub = () => {
    window.open(
      "https://www.github.com/line/abc-virtual-background-maker",
      "_blank",
      "noopener,noreferrer",
    );
  };

  const handleClickInput = (label: string) => {
    setInputOptions((prevState) => {
      return {
        ...prevState,
        [label]: {
          ...prevState[label],
          isVisible: !prevState[label]?.isVisible,
        },
      };
    });
  };

  const handleFocusInput = (event: FocusEvent<HTMLDivElement>) => {
    setFocusedInput(
      event.currentTarget.getElementsByTagName("span")[0].textContent ?? "",
    );
  };

  const handleBlurInput = (event: FocusEvent<HTMLDivElement>) => {
    if (
      !event.relatedTarget ||
      !focusedAreaRef.current?.contains(event.relatedTarget)
    ) {
      setFocusedInput("");
      focusedAreaRef.current?.blur();
    }
  };

  const handleReset = useCallback(() => {
    if (inputRefs?.current) {
      const date = new Date();
      setDragKey(date.toLocaleString());
    }
    const initialOptions: Record<string, InputField> = {};
    inputFields.map(({ fields }) => {
      fields.map(
        ({ label, fontSize, fontStyle = DEFAULT_FONT_STYLE, text }, index) => {
          initialOptions[label] = {
            label,
            fontStyle,
            fontSize,
            text,
            isVisible: true,
            opacity: index === 0 ? 100 : 60,
          };
        },
      );
    });
    setInputOptions(initialOptions);
    setPartnerLogoPosition(AUTO);
    setPartnerLogoSize(AUTO);
  }, [inputFields]);

  const handleChangeFontStyle = (style: Font) => {
    setInputOptions((prevState) => {
      return {
        ...prevState,
        [focusedInput]: {
          ...prevState[focusedInput],
          fontStyle: style,
        },
      };
    });
    inputRefs.current[focusedInput].focus();
  };

  const handleChangeFontSize = (size: FontSize) => {
    setInputOptions((prevState) => {
      return {
        ...prevState,
        [focusedInput]: {
          ...prevState[focusedInput],
          fontSize: size,
        },
      };
    });
    inputRefs.current[focusedInput].focus();
  };

  const handleChangeFontColor = (color: string) => {
    setInputOptions((prevState) => {
      return {
        ...prevState,
        [focusedInput]: {
          ...prevState[focusedInput],
          fontColor: color,
        },
      };
    });
    inputRefs.current[focusedInput].focus();
  };

  const handleChangeOpacity = (opacity: number) => {
    setInputOptions((prevState) => {
      return {
        ...prevState,
        [focusedInput]: {
          ...prevState[focusedInput],
          opacity,
        },
      };
    });
    inputRefs.current[focusedInput].focus();
  };

  const handleChangeAlignment = (align: Alignment) => {
    setInputOptions((prevState) => {
      return {
        ...prevState,
        [focusedInput]: {
          ...prevState[focusedInput],
          alignment: align,
        },
      };
    });
  };

  useEffect(() => {
    setInputFields(initialInputFields);
  }, [initialInputFields]);

  useEffect(() => {
    setInitialColor(
      fontColor
        ? fontColor
        : isDarkImage === null
          ? "transparent"
          : isDarkImage
            ? "255,255,255"
            : "0,0,0",
    );
  }, [fontColor, isDarkImage]);

  useEffect(() => {
    handleReset();
  }, [handleReset, selectedTheme]);

  return (
    <>
      <div className={styles.edit}>
        <div className={styles.inner}>
          <EditableImage
            dragKey={dragKey}
            ref={ref}
            isEditable
            isImageFlip={isImageFlip}
            src={src}
            fontColor={fontColor}
            inputRefs={inputRefs}
            inputFields={inputFields}
            inputOptions={inputOptions}
            focusedInput={focusedInput}
            handleFocusInput={handleFocusInput}
            handleBlurInput={handleBlurInput}
            partnerLogo={partnerLogo}
          />
        </div>
        <div className={styles.buttons}>
          <TextButton
            icon={<span className="material-symbols-outlined">help</span>}
            onClick={() => setGuideVisible(true)}
          >
            How To Contribute
          </TextButton>
          <TextButton icon={<IconGithub />} onClick={handleClickGithub}>
            Github
          </TextButton>
        </div>
      </div>
      <div className={styles.side}>
        {focusedInput ? (
          <>
            <h3>{focusedInput}</h3>
            <ul
              ref={focusedAreaRef}
              onFocus={() => inputRefs.current[focusedInput].focus()}
              tabIndex={0}
            >
              <li className={styles.custom}>
                <strong>Font</strong>
                <Select
                  defaultValue={inputOptions?.[focusedInput]?.fontStyle}
                  value={inputOptions?.[focusedInput]?.fontStyle}
                  onChange={(style) => handleChangeFontStyle(style as Font)}
                  options={(Object.keys(Fonts) as Array<Font>).map((size) => ({
                    name: size,
                    value: size,
                  }))}
                />
              </li>
              <li className={styles.custom}>
                <strong>Size</strong>
                <Select
                  defaultValue={inputOptions?.[focusedInput]?.fontSize}
                  value={inputOptions?.[focusedInput]?.fontSize}
                  onChange={(size) => handleChangeFontSize(size as FontSize)}
                  options={(Object.keys(FontSizes) as Array<FontSize>).map(
                    (size) => ({
                      name: size,
                      value: size,
                    }),
                  )}
                />
              </li>
              <li className={styles.custom}>
                <strong>Color</strong>
                <ColorPicker
                  defaultValue={
                    inputOptions?.[focusedInput]?.fontColor ??
                    convertRgbToHex(initialColor ?? "")
                  }
                  onChange={(e) => handleChangeFontColor(e.target.value)}
                />
              </li>
              <li className={styles.custom}>
                <strong>Opacity</strong>
                <OpacityRange
                  defaultValue={inputOptions?.[focusedInput]?.opacity}
                  onChange={(e) => handleChangeOpacity(Number(e.target.value))}
                />
              </li>
              <li className={styles.custom}>
                <strong>Alignment</strong>
                <AlignSelect
                  defaultValue={
                    inputOptions?.[focusedInput]?.alignment ?? "left"
                  }
                  value={inputOptions?.[focusedInput]?.alignment}
                  onChange={(alignment) =>
                    handleChangeAlignment(alignment as Alignment)
                  }
                  options={(Object.keys(Alignments) as Array<Alignment>).map(
                    (alignment) => ({
                      name: alignment,
                      value: alignment,
                    }),
                  )}
                />
              </li>
            </ul>
          </>
        ) : (
          <>
            <h3>Text Option</h3>
            {inputFields.map(({ fields }, index) => (
              <ul key={index}>
                {fields.map(({ label, isRequired }, index) => (
                  <li key={index}>
                    <ToggleOption
                      label={label}
                      isRequired={isRequired}
                      isSelected={Boolean(inputOptions[label]?.isVisible)}
                      onClick={() => handleClickInput(label)}
                    />
                  </li>
                ))}
              </ul>
            ))}
            {partnerLogoConfig && (
              <>
                <h3>Partner Logo</h3>
                <ul>
                  <li>
                    <ToggleOption
                      label={partnerLogoConfig.alt ?? "Partner Logo"}
                      isSelected={isPartnerLogoVisible}
                      onClick={() =>
                        setIsPartnerLogoVisible(!isPartnerLogoVisible)
                      }
                    />
                  </li>
                  {isPartnerLogoVisible && (
                    <>
                      <li className={styles.custom}>
                        <strong>Position</strong>
                        <Select
                          defaultValue={partnerLogoPosition}
                          value={partnerLogoPosition}
                          onChange={(position) =>
                            setPartnerLogoPosition(
                              position as PartnerLogoPosition | typeof AUTO,
                            )
                          }
                          options={partnerLogoPositionOptions}
                        />
                      </li>
                      <li className={styles.custom}>
                        <strong>Size</strong>
                        <Select
                          defaultValue={partnerLogoSize}
                          value={partnerLogoSize}
                          onChange={(size) =>
                            setPartnerLogoSize(
                              size as PartnerLogoSize | typeof AUTO,
                            )
                          }
                          options={partnerLogoSizeOptions}
                        />
                      </li>
                    </>
                  )}
                </ul>
              </>
            )}
            <h3>Image Option</h3>
            <ul>
              <li>
                <ToggleOption
                  label={
                    <>
                      <span className="material-symbols-outlined">flip</span>
                      Horizontal Flip
                    </>
                  }
                  isSelected={isImageFlip}
                  onClick={() => setIsImageFlip(!isImageFlip)}
                />
              </li>
              <li>
                <TextButton
                  icon={
                    <span className="material-symbols-outlined">
                      reset_image
                    </span>
                  }
                  onClick={handleReset}
                  className={styles.reset}
                >
                  Reset Image
                </TextButton>
              </li>
            </ul>
          </>
        )}
      </div>
      <GuideDialog
        isVisible={guideVisible}
        onClose={() => setGuideVisible(false)}
      />
    </>
  );
});

export default Editor;
