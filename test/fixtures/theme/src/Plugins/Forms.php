<?php
$outside = ['text-unknown-outside'];
// tw-sweep-classes-start
$selectors['field-wrap']['parts']['label-inner'] = [
	// The plugin's own comment must not open a string.
	'text-xl',
	'[.es-field\_\_content-wrap_&]:rounded-none',
	'w-[16px]',
];
$map = ['select-choices' => 'text-body-sm'];
$single = ['aspect-[5/3]'];
$indexed = $selectors['text-unknown-index'];
$wrapped = Helpers::getTwClasses($attributes, $manifest, 'h-[16px]');
$escaped = ["w-[16px]\nh-full", '[&_.card\_icon]:w-[16px] content-[\'x\']'];
// tw-sweep-classes-end
